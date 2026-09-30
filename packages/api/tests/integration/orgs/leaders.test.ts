/**
 * A leader managing leadership (organizations.ts): add a co-leader by email,
 * step down — but never leave the organisation leaderless.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let leader: TestUser
let colleague: TestUser
let outsider: TestUser
let orgId: string
const req = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

beforeAll(async () => {
  ;[leader, colleague, outsider] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  const admin = adminClient()
  orgId = (await admin.from('organizations').insert({ name: `Leaders ${Date.now()}`, status: 'active' }).select('id').single()).data!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
})

afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, colleague, outsider].map((u) => deleteTestUser(u.id)))
})

describe('organisation leaders', () => {
  it('hides the list from someone who does not lead it', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(outsider.token, 'GET'))
    expect(res.status).toBe(404)
  })

  it('refuses the last leader stepping down', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE'))
    expect(res.status).toBe(409)
  })

  it('says so when no account uses the email', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: 'nobody@splat-test.local' }))
    expect(res.status).toBe(404)
  })

  it('adds a co-leader by email, who then sees the list', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: colleague.email.toUpperCase() }))
    expect(res.status).toBe(201)
    const list = await app.request(`/api/organizations/${orgId}/leaders`, req(colleague.token, 'GET'))
    const rows = (await list.json()) as { user_id: string; you: boolean }[]
    expect(rows.map((r) => r.user_id).sort()).toEqual([leader.id, colleague.id].sort())
    expect(rows.find((r) => r.user_id === colleague.id)!.you).toBe(true)
  })

  it('lets a leader step down once someone else leads', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE'))
    expect(res.status).toBe(204)
    const { data } = await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)
    expect(data).toEqual([{ user_id: colleague.id }])
  })
})
