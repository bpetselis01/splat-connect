import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let untermedAuthor: TestUser
let leader: TestUser
let orgId: string
let draft: string
let backed: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  author = await createTestUser('contributor')
  untermedAuthor = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  await acceptTerms(author.id, 'contributor_terms')
  await acceptTerms(leader.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)

  draft = await createProject({ authorId: author.id, status: 'draft' })
  backed = await createProject({ authorId: untermedAuthor.id, status: 'draft' })
  await requestBacking({ tutorialId: backed, orgId, status: 'accepted' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [draft, backed])
  await deleteTestUser(author.id)
  await deleteTestUser(untermedAuthor.id)
  await deleteTestUser(leader.id)
})

describe('PATCH /api/tutorials/:id', () => {
  it('applies the editable fields', async () => {
    const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Renamed', difficulty: 'hard' }),
    }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { title: string }).title).toBe('Renamed')
  })

  it('drops unknown keys instead of writing them', async () => {
    const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Renamed again', nonsense: true }),
    }))
    expect(res.status).toBe(200)
  })

  it('403s on the protected audit fields', async () => {
    for (const field of ['reviewed_by', 'reviewed_for_org_id', 'reviewed_at', 'rejection_note']) {
      const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: author.id }),
      }))
      expect(res.status).toBe(403)
    }
  })

  it('403s when a leader tries to publish through this endpoint', async () => {
    // The leader's RLS grant WOULD permit this write. The refusal is the route's,
    // and it exists so no publish can skip reviewed_by and reviewed_for_org_id.
    const res = await app.request(`/api/tutorials/${backed}`, authed(leader.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(403)

    const { data } = await adminClient()
      .from('tutorials').select('status').eq('id', backed).single()
    expect(data?.status).toBe('draft')
  })

  it('403s on draft to pending with no accepted contributor terms', async () => {
    const res = await app.request(`/api/tutorials/${backed}`, authed(untermedAuthor.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending' }),
    }))
    expect(res.status).toBe(403)

    await acceptTerms(untermedAuthor.id, 'contributor_terms')
    const after = await app.request(`/api/tutorials/${backed}`, authed(untermedAuthor.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending' }),
    }))
    expect(after.status).toBe(200)
  })
})

describe('POST /api/tutorials', () => {
  it('403s with no accepted contributor terms', async () => {
    const fresh = await createTestUser('contributor')
    const res = await app.request('/api/tutorials', authed(fresh.token, {
      method: 'POST',
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'Gated', difficulty: 'easy' }),
    }))
    expect(res.status).toBe(403)
    await deleteTestUser(fresh.id)
  })
})
