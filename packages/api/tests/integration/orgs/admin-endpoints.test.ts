import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let admin: TestUser
let leader: TestUser
let second: TestUser
let parent: TestUser
let author: TestUser
const createdOrgIds: string[] = []
let project: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  admin = await createTestUser('admin')
  leader = await createTestUser('contributor')
  second = await createTestUser('contributor')
  parent = await createTestUser('parent')
  author = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')
  project = await createProject({ authorId: author.id })
})

afterAll(async () => {
  for (const id of createdOrgIds) await cleanupOrg(id)
  await adminClient().from('tutorials').delete().eq('id', project)
  await deleteTestUser(admin.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(second.id)
  await deleteTestUser(parent.id)
  await deleteTestUser(author.id)
})

describe('POST /api/admin/organizations', () => {
  it('creates an active org and its first leader in one call', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Riverside Therapy', leader_user_id: leader.id }),
    }))
    expect(res.status).toBe(201)
    const org = (await res.json()) as { id: string; status: string }
    createdOrgIds.push(org.id)
    expect(org.status).toBe('active')

    const { data } = await adminClient()
      .from('org_leaders').select('user_id').eq('org_id', org.id)
    expect(data?.map((l) => l.user_id)).toEqual([leader.id])
  })

  it('refuses a contributor', async () => {
    const res = await app.request('/api/admin/organizations', authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Self Serve', leader_user_id: leader.id }),
    }))
    expect(res.status).toBe(403)
  })

  it('refuses a leader who is not a contributor', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Parent Led', leader_user_id: parent.id }),
    }))
    expect(res.status).toBe(400)
  })

  it('refuses a request with no leader_user_id', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Leaderless' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('leader appointment', () => {
  it('appoints a second leader, and the appointment persists', async () => {
    // Assert against the database, not the status code: the superseded design
    // shipped a leadership endpoint that reported success and changed nothing.
    const orgId = createdOrgIds[0]
    const res = await app.request(`/api/admin/organizations/${orgId}/leaders`, authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ user_id: second.id }),
    }))
    expect(res.status).toBe(201)

    const { data } = await adminClient()
      .from('org_leaders').select('user_id').eq('org_id', orgId).eq('user_id', second.id)
    expect(data).toHaveLength(1)
  })

  it('removing a leader persists', async () => {
    const orgId = createdOrgIds[0]
    await requestBacking({ tutorialId: project, orgId, status: 'accepted', respondedBy: leader.id })

    const res = await app.request(
      `/api/admin/organizations/${orgId}/leaders/${second.id}`,
      authed(admin.token, { method: 'DELETE' }),
    )
    expect(res.status).toBe(204)

    const { data } = await adminClient()
      .from('org_leaders').select('id').eq('org_id', orgId).eq('user_id', second.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('a leader cannot appoint anyone', async () => {
    const res = await app.request(`/api/admin/organizations/${createdOrgIds[0]}/leaders`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ user_id: second.id }),
    }))
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/organizations/:id', () => {
  it('suspends and reactivates', async () => {
    const orgId = createdOrgIds[0]
    const off = await app.request(`/api/admin/organizations/${orgId}`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    }))
    expect(off.status).toBe(200)
    expect(((await off.json()) as { status: string }).status).toBe('suspended')

    const on = await app.request(`/api/admin/organizations/${orgId}`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    }))
    expect(((await on.json()) as { status: string }).status).toBe('active')
  })

  it('refuses an unknown status', async () => {
    const res = await app.request(`/api/admin/organizations/${createdOrgIds[0]}`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'probation' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('the admin queue and spot-check', () => {
  it('shows every pending tutorial, with backing state on the row', async () => {
    const res = await app.request('/api/admin/tutorials?status=pending', authed(admin.token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{
      id: string
      tutorial_orgs: Array<{ status: string; organizations: { name: string } }>
    }>
    const row = rows.find((r) => r.id === project)
    // Decision 23: an accepted backing does not remove it from the admin's view.
    expect(row).toBeTruthy()
    expect(row!.tutorial_orgs.some((b) => b.status === 'accepted')).toBe(true)
    expect(row!.tutorial_orgs[0].organizations.name).toBeTruthy()
  })

  it('samples tutorials the admin did not approve, and excludes their own', async () => {
    const mine = await createProject({ authorId: author.id, status: 'approved' })
    const theirs = await createProject({ authorId: author.id, status: 'approved' })
    await adminClient().from('tutorials').update({ reviewed_by: admin.id }).eq('id', mine)
    await adminClient().from('tutorials').update({ reviewed_by: leader.id }).eq('id', theirs)

    const res = await app.request('/api/admin/spot-check', authed(admin.token))
    const ids = ((await res.json()) as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(theirs)
    expect(ids).not.toContain(mine)

    await adminClient().from('tutorials').delete().in('id', [mine, theirs])
  })

  it('403s for a contributor', async () => {
    const res = await app.request('/api/admin/spot-check', authed(leader.token))
    expect(res.status).toBe(403)
  })

  it('an admin can reject a tutorial a leader already published', async () => {
    // Spec §5 test 16, and the last of the three reactive controls that replace
    // the self-review block. The status endpoint places no constraint on the
    // transition, so approved -> rejected pulls a bad approval back down.
    const published = await createProject({ authorId: author.id, status: 'approved' })
    await adminClient().from('tutorials').update({
      reviewed_by: leader.id, reviewed_for_org_id: createdOrgIds[0],
    }).eq('id', published)

    const res = await app.request(`/api/admin/tutorials/${published}/status`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials').select('status, rejection_note, reviewed_by').eq('id', published).single()
    expect(data).toMatchObject({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' })
    // The admin's own id replaces the leader's: whoever last decided is who the
    // audit trail names.
    expect(data?.reviewed_by).toBe(admin.id)

    await adminClient().from('tutorials').delete().eq('id', published)
  })
})
