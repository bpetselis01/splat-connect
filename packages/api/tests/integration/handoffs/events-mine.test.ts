// journeys: V01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, cleanupOrg } from '../../helpers/orgs.js'

/**
 * Hand-off: a family registers for an event on the WEB (the register form posts
 * this same route; mobile has no registration screen), and the mobile
 * "My events" list reads it back.
 */
let family: TestUser
let stranger: TestUser
let orgId: string
let eventId: string
const authed = (t: TestUser, method = 'GET', body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
const mine = async (t: TestUser) =>
  (await (await app.request('/api/events/mine', authed(t))).json()) as {
    event: { id: string; title: string; org_name: string }
  }[]

beforeAll(async () => {
  ;[family, stranger] = await Promise.all([createTestUser(), createTestUser()])
  orgId = await createOrg({ createdBy: family.id, name: `Mine Org ${Date.now()}` })
  const { data, error } = await adminClient()
    .from('org_events')
    .insert({
      org_id: orgId,
      kind: 'build_day',
      title: 'Hand-off build day',
      starts_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      format: 'in_person',
      location: 'A hall',
      suburb: 'Crows Nest',
      state: 'NSW',
      status: 'published',
      created_by: family.id,
    })
    .select('id')
    .single()
  if (error) throw error
  eventId = data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('org_event_registrations').delete().eq('event_id', eventId)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await cleanupOrg(orgId)
  await Promise.all([family, stranger].map((u) => deleteTestUser(u.id)))
})

describe('My events after a web registration', () => {
  it('is empty before anyone registers', async () => {
    expect(await mine(family)).toEqual([])
  })

  it('lists the event, with its organisation, for the person who registered and nobody else', async () => {
    const res = await app.request(
      `/api/events/${eventId}/registrations`,
      authed(family, 'POST', { name: 'A Family', email: 'family@example.com', answers: {} })
    )
    expect(res.status).toBe(201)
    const rows = await mine(family)
    expect(rows.map((r) => r.event.id)).toEqual([eventId])
    expect(rows[0]!.event.title).toBe('Hand-off build day')
    expect(rows[0]!.event.org_name).toMatch(/^Mine Org/)
    expect(await mine(stranger)).toEqual([])
  })

  it('drops the event again once the registration is cancelled', async () => {
    const res = await app.request(`/api/events/${eventId}/registrations`, authed(family, 'DELETE'))
    expect(res.status).toBe(200)
    expect(await mine(family)).toEqual([])
  })
})
