/**
 * The people registered for an event are told when it moves or is cancelled
 * (138) — and nobody else, and not for an edit that changes neither.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let leader: TestUser
let going: TestUser
let withdrew: TestUser
let orgId: string
let eventId: string

const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const at = (days: number) => new Date(Date.now() + days * 864e5).toISOString()

const full = (over: Record<string, unknown> = {}) => ({
  title: 'Change build day',
  kind: 'build_day',
  starts_at: START,
  format: 'in_person',
  location: 'A hall, 1 Test St',
  suburb: 'Crows Nest',
  state: 'NSW',
  audience: 'Families',
  status: 'published',
  ...over,
})
const START = at(14)

async function noticesFor(userId: string) {
  const { data } = await adminClient()
    .from('notifications')
    .select('type, actor_name, tutorial_title')
    .eq('recipient_id', userId)
    .eq('org_event_id', eventId)
  return data ?? []
}

beforeAll(async () => {
  ;[leader, going, withdrew] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  const admin = adminClient()
  const { data: org } = await admin
    .from('organizations')
    .insert({ name: `Change Org ${Date.now()}`, status: 'active' })
    .select('id')
    .single()
  orgId = org!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
  const { data: event } = await admin
    .from('org_events')
    .insert({ ...full(), org_id: orgId, created_by: leader.id })
    .select('id')
    .single()
  eventId = event!.id
  await admin.from('org_event_registrations').insert([
    { event_id: eventId, user_id: going.id, name: 'Going', email: 'going@example.com', answers: {} },
    {
      event_id: eventId, user_id: withdrew.id, name: 'Withdrew', email: 'w@example.com', answers: {},
      cancelled_at: new Date().toISOString(),
    },
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().eq('org_event_id', eventId)
  await admin.from('org_event_registrations').delete().eq('event_id', eventId)
  await admin.from('org_events').delete().eq('id', eventId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, going, withdrew].map((u) => deleteTestUser(u.id)))
})

describe('telling the registered', () => {
  it('says nothing for an edit that keeps the time and place', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}`,
      json(leader.token, 'PATCH', full({ title: 'Change build day', description: 'Bring a toy.' }))
    )
    expect(res.status).toBe(200)
    expect(await noticesFor(going.id)).toEqual([])
  })

  it('WB20 tells someone going when the time moves, and not someone who withdrew or the leader', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}`,
      json(leader.token, 'PATCH', full({ starts_at: at(15) }))
    )
    expect(res.status).toBe(200)
    expect(await noticesFor(going.id)).toEqual([
      expect.objectContaining({ type: 'org_event_changed', tutorial_title: 'Change build day' }),
    ])
    expect(await noticesFor(withdrew.id)).toEqual([])
    expect(await noticesFor(leader.id)).toEqual([])
  })

  it('WB21 tells them when it is cancelled', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}`,
      json(leader.token, 'PATCH', { cancelled: true })
    )
    expect(res.status).toBe(200)
    expect((await noticesFor(going.id)).map((n) => n.type).sort()).toEqual(['org_event_cancelled', 'org_event_changed'])
  })

  it('does not tell them twice when a cancelled event is saved again', async () => {
    await app.request(`/api/organizations/${orgId}/events/${eventId}`, json(leader.token, 'PATCH', { cancelled: true }))
    expect(await noticesFor(going.id)).toHaveLength(2)
  })
})
