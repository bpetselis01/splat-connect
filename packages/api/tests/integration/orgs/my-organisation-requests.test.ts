// journeys: (none — route coverage; no journey row names this route yet)
/** GET /api/organizations/requests lists the caller's own requests for an organisation to exist, newest first, and nobody else's. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let member: TestUser
let other: TestUser

const list = (token?: string) => app.request('/api/organizations/requests', token ? { headers: { Authorization: `Bearer ${token}` } } : {})

beforeAll(async () => {
  ;[member, other] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const ask = (requester_id: string, org_name: string, created_at: string) => ({
    requester_id, org_name, what_they_do: 'Adapts toys', verification: 'Staff page', created_at, status: 'pending',
  })
  const { error } = await adminClient().from('organization_requests').insert([
    ask(member.id, 'Older Clinic', new Date(Date.now() - 2 * 864e5).toISOString()),
    ask(member.id, 'Newer Library', new Date(Date.now() - 1 * 864e5).toISOString()),
    ask(other.id, 'Somebody Else’s Hub', new Date().toISOString()),
  ])
  if (error) throw new Error(error.message)
})
afterAll(async () => {
  await adminClient().from('organization_requests').delete().in('requester_id', [member.id, other.id])
  for (const u of [member, other]) await deleteTestUser(u.id)
})

describe('my organisation requests', () => {
  it('lists only the caller’s requests, newest first, with their status', async () => {
    const res = await list(member.token)
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ org_name: string; status: string; requester_id: string }>
    expect(rows.map((r) => [r.org_name, r.status, r.requester_id])).toEqual([
      ['Newer Library', 'pending', member.id],
      ['Older Clinic', 'pending', member.id],
    ])
  })

  it('gives a member with no requests an empty list', async () => {
    const fresh = await createTestUser('contributor')
    try {
      const res = await list(fresh.token)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    } finally {
      await deleteTestUser(fresh.id)
    }
  })

  it('needs a signed-in member', async () => {
    expect((await list()).status).toBe(401)
  })
})
