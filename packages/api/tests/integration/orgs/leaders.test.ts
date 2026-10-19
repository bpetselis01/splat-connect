/**
 * Leaders managing leadership (organizations.ts + 084): invite a co-leader by
 * the exact email of their account, the invitee accepts or declines, and
 * stepping down never leaves the organisation leaderless — not even when two
 * leaders try at once.
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

  it('WB35 refuses the last leader stepping down', async () => {
    expect((await app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE'))).status).toBe(409)
  })

  it('treats the email literally: a wildcard matches nobody', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: '%@splat-test.local' }))
    expect(res.status).toBe(404)
  })

  it('L26 WB34 lets a leader cancel an invitation, and nobody else', async () => {
    const invite = async () =>
      (await adminClient().from('org_leader_invites').select('id').eq('org_id', orgId)).data ?? []
    expect((await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: outsider.email }))).status).toBe(201)
    const [row] = await invite()

    // Someone who does not lead the organisation is told it does not exist and nothing is deleted.
    const refused = await app.request(`/api/organizations/${orgId}/leaders/invites/${row!.id}`, req(outsider.token, 'DELETE'))
    expect(refused.status).toBe(404)
    expect(await invite()).toHaveLength(1)

    const cancelled = await app.request(`/api/organizations/${orgId}/leaders/invites/${row!.id}`, req(leader.token, 'DELETE'))
    expect(cancelled.status).toBe(204)
    expect(await invite()).toHaveLength(0)
    const mine = (await (await app.request('/api/organizations/invites/mine', req(outsider.token, 'GET'))).json()) as unknown[]
    expect(mine).toHaveLength(0)
  })

  it('L25 WB33 invites rather than adds: the invitee is not a leader until they accept', async () => {
    const res = await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'POST', { email: colleague.email.toUpperCase() }))
    expect(res.status).toBe(201)
    expect(await leadersOf()).toEqual([leader.id])

    const list = (await (await app.request(`/api/organizations/${orgId}/leaders`, req(leader.token, 'GET'))).json()) as {
      invites: { email: string }[]
    }
    expect(list.invites.map((i) => i.email)).toEqual([colleague.email])
  })

  it('L31 WD08 lets only the invitee accept', async () => {
    const mine = (await (await app.request('/api/organizations/invites/mine', req(colleague.token, 'GET'))).json()) as { id: string }[]
    expect(mine).toHaveLength(1)
    expect((await app.request(`/api/organizations/invites/${mine[0]!.id}/accept`, req(outsider.token, 'POST'))).status).toBe(404)
    expect((await app.request(`/api/organizations/invites/${mine[0]!.id}/accept`, req(colleague.token, 'POST'))).status).toBe(200)
    expect(await leadersOf()).toEqual([leader.id, colleague.id].sort())
  })

  it('L27 WB35 never leaves the organisation leaderless when both step down at once', async () => {
    const results = await Promise.all([
      app.request(`/api/organizations/${orgId}/leaders/me`, req(leader.token, 'DELETE')),
      app.request(`/api/organizations/${orgId}/leaders/me`, req(colleague.token, 'DELETE')),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([204, 409])
    expect(await leadersOf()).toHaveLength(1)
  })
})
