/**
 * Leaders managing leadership (organizations.ts + 084): invite a co-leader by
 * the exact email of their account, the invitee accepts or declines, and
 * stepping down never leaves the organisation leaderless — not even when two
 * leaders try at once.
 */
// journeys: L25 L27 L31
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
const leadersOf = async () =>
  ((await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data ?? []).map((r) => r.user_id).sort()

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
    expect((await app.request(`/api/organizations/${orgId}/leaders`, req(outsider.token, 'GET'))).status).toBe(404)
  })

  it('refuses the last leader stepping down', async () => {
    expect((await app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE'))).status).toBe(409)
  })

  it('treats the email literally: a wildcard matches nobody', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: '%@splat-test.local' }))
    expect(res.status).toBe(404)
  })

  it('invites rather than adds: the invitee is not a leader until they accept', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: colleague.email.toUpperCase() }))
    expect(res.status).toBe(201)
    expect(await leadersOf()).toEqual([leader.id])

    const list = (await (await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'GET'))).json()) as {
      invites: { email: string }[]
    }
    expect(list.invites.map((i) => i.email)).toEqual([colleague.email])
  })

  it('lets only the invitee accept', async () => {
    const mine = (await (await app.request('/api/organizations/invites/mine', req(colleague.token, 'GET'))).json()) as { id: string }[]
    expect(mine).toHaveLength(1)
    expect((await app.request(`/api/organizations/invites/${mine[0]!.id}/accept`, req(outsider.token, 'POST'))).status).toBe(404)
    expect((await app.request(`/api/organizations/invites/${mine[0]!.id}/accept`, req(colleague.token, 'POST'))).status).toBe(200)
    expect(await leadersOf()).toEqual([leader.id, colleague.id].sort())
  })

  it('never leaves the organisation leaderless when both step down at once', async () => {
    const results = await Promise.all([
      app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE')),
      app.request(`/api/organizations/${orgId}/leaders/me`, req(colleague.token, 'DELETE')),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([204, 409])
    expect(await leadersOf()).toHaveLength(1)
  })
})
