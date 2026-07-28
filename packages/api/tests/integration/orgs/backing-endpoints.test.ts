import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let stranger: TestUser
let orgId: string
let otherOrgId: string
let draft: string
let published: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  otherOrgId = await createOrg({ createdBy: leader.id })
  draft = await createProject({ authorId: author.id, status: 'draft' })
  published = await createProject({ authorId: author.id, status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [draft, published])
  await cleanupOrg(otherOrgId)
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(stranger.id)
})

describe('POST /api/tutorials/:id/orgs', () => {
  it('records the request as pending', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(author.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { status: string }).status).toBe('pending')
  })

  it('is idempotent on a repeat request', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(author.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(200)
  })

  it('403s for someone who is not the author', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(stranger.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: otherOrgId }),
    }))
    expect(res.status).toBe(403)
  })

  it('403s once the tutorial is published', async () => {
    const res = await app.request(`/api/tutorials/${published}/orgs`, authed(author.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(403)
  })
})

describe('answering', () => {
  it('a leader of the asked org can accept', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}/accept`, authed(leader.token, {
      method: 'POST',
    }))
    expect(res.status).toBe(200)
    const row = (await res.json()) as { status: string; responded_by: string }
    expect(row.status).toBe('accepted')
    expect(row.responded_by).toBe(leader.id)
  })

  it('403s for the author trying to answer their own request', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}/accept`, authed(author.token, {
      method: 'POST',
    }))
    expect(res.status).toBe(403)
  })

  it('403s for a leader of an organisation that was not asked', async () => {
    await requestBacking({ tutorialId: published, orgId: otherOrgId })
    const res = await app.request(`/api/tutorials/${published}/orgs/${otherOrgId}/decline`, authed(stranger.token, {
      method: 'POST',
    }))
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/tutorials/:id/orgs/:orgId', () => {
  it('the author can withdraw before publication', async () => {
    const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}`, authed(author.token, {
      method: 'DELETE',
    }))
    expect(res.status).toBe(204)
  })

  it('403s once that organisation approved the published tutorial', async () => {
    await requestBacking({ tutorialId: published, orgId, status: 'accepted' })
    await adminClient().from('tutorials').update({
      reviewed_by: leader.id, reviewed_for_org_id: orgId,
    }).eq('id', published)

    const res = await app.request(`/api/tutorials/${published}/orgs/${orgId}`, authed(author.token, {
      method: 'DELETE',
    }))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/tutorials/:id/orgs', () => {
  it('returns the backing rows with the organisation embedded', async () => {
    const res = await app.request(`/api/tutorials/${published}/orgs`, authed(author.token))
    const rows = (await res.json()) as Array<{ org_id: string; organizations: { name: string } }>
    expect(rows.map((r) => r.org_id)).toContain(orgId)
    expect(rows.find((r) => r.org_id === orgId)?.organizations.name).toBeTruthy()
  })
})
