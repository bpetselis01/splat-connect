// journeys: (none — route coverage; no journey row names this route yet)
/**
 * GET /api/admin/organization-requests is the admin's queue of asks to make an
 * organisation. It lists every status, oldest first, and names the requester
 * through the admin client (045 closed the profiles embed). Members get 403.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let member: TestUser
let requester: TestUser
const ids: string[] = []

const list = (token: string) => app.request('/api/admin/organization-requests', { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  ;[admin, member, requester] = await Promise.all([createTestUser('admin'), createTestUser(), createTestUser()])
  const sb = adminClient()
  const row = (org_name: string, created_at: string, extra = {}) => ({
    requester_id: requester.id,
    org_name,
    what_they_do: 'Builds switch toys.',
    verification: 'Work email.',
    created_at,
    status: 'pending',
    ...extra,
  })
  const { data, error } = await sb
    .from('organization_requests')
    .insert([
      row('Second Org', '2020-01-02T00:00:00Z'),
      row('First Org', '2020-01-01T00:00:00Z'),
      row('Declined Org', '2020-01-03T00:00:00Z', { status: 'declined', reviewed_at: '2020-01-04T00:00:00Z', review_note: 'No.' }),
    ])
    .select('id')
  if (error) throw new Error(error.message)
  ids.push(...data!.map((r) => r.id))
})

afterAll(async () => {
  await adminClient().from('organization_requests').delete().in('id', ids)
  await Promise.all([admin, member, requester].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/admin/organization-requests', () => {
  it('an admin gets the requests oldest first, each with its requester and status', async () => {
    const res = await list(admin.token)
    expect(res.status).toBe(200)
    const rows = ((await res.json()) as Array<{ org_name: string; status: string; requester: { id: string; email: string } | null }>).filter(
      (r) => r.requester?.id === requester.id
    )
    expect(rows.map((r) => [r.org_name, r.status])).toEqual([
      ['First Org', 'pending'],
      ['Second Org', 'pending'],
      ['Declined Org', 'declined'],
    ])
    expect(rows[0].requester!.email).toBe(requester.email)
  })

  it('a member is refused with 403', async () => {
    const res = await list(member.token)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  it('a request with no session is 401', async () => {
    expect((await app.request('/api/admin/organization-requests')).status).toBe(401)
  })
})
