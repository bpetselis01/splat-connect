/**
 * Leader changes and a deleted event (142): the person made or un-made a
 * leader is told, and so is everyone still registered for a deleted event.
 * Each `it` title names its type for scripts/journeys/notifications.mjs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const call = (token: string, method: string, path: string, body?: unknown) =>
  app.request(`http://localhost/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

let admin: TestUser
let leader: TestUser
let newLeader: TestUser
let going: TestUser
let withdrew: TestUser
let orgId: string
const orgName = `Leaders Org ${Date.now()}`
const eventIds: string[] = []

async function noticesFor(recipient: string, type: string) {
  const { data } = await adminClient()
    .from('notifications')
    .select('type, actor_name, body, org_id, org_event_id')
    .eq('recipient_id', recipient)
    .eq('type', type)
  return data ?? []
}

async function event(title: string) {
  const { data } = await adminClient()
    .from('org_events')
    .insert({
      org_id: orgId, created_by: leader.id, title, kind: 'build_day', format: 'in_person', location: '1 Test St',
      suburb: 'Crows Nest', state: 'NSW', audience: 'Families', status: 'published',
      starts_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    })
    .select('id')
    .single()
  eventIds.push(data!.id)
  return data!.id as string
}

beforeAll(async () => {
  ;[admin, leader, newLeader, going, withdrew] = await Promise.all(
    ['admin', 'contributor', 'contributor', 'contributor', 'contributor'].map((r) => createTestUser(r as 'admin' | 'contributor'))
  )
  const sb = adminClient()
  const { data: org } = await sb.from('organizations').insert({ name: orgName, status: 'active' }).select('id').single()
  orgId = org!.id
  await sb.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('org_event_registrations').delete().in('event_id', eventIds)
  await sb.from('org_events').delete().in('id', eventIds)
  await sb.from('org_leaders').delete().eq('org_id', orgId)
  await sb.from('organizations').delete().eq('id', orgId)
  await Promise.all([admin, leader, newLeader, going, withdrew].map((u) => deleteTestUser(u.id)))
})

describe('leaders', () => {
  it('leader_added tells the person once, naming the organisation, and a repeat add sends nothing', async () => {
    expect((await call(admin.token, 'POST', `/admin/organizations/${orgId}/leaders`, { user_id: newLeader.id })).status).toBe(201)
    expect((await call(admin.token, 'POST', `/admin/organizations/${orgId}/leaders`, { user_id: newLeader.id })).status).toBe(200)
    expect(await noticesFor(newLeader.id, 'leader_added')).toEqual([
      { type: 'leader_added', actor_name: orgName, body: null, org_id: orgId, org_event_id: null },
    ])
  })

  it('leader_removed tells the person once, and removing someone who is not a leader sends nothing', async () => {
    expect((await call(admin.token, 'DELETE', `/admin/organizations/${orgId}/leaders/${newLeader.id}`)).status).toBe(204)
    expect((await call(admin.token, 'DELETE', `/admin/organizations/${orgId}/leaders/${newLeader.id}`)).status).toBe(404)
    expect(await noticesFor(newLeader.id, 'leader_removed')).toEqual([
      { type: 'leader_removed', actor_name: orgName, body: null, org_id: orgId, org_event_id: null },
    ])
  })
})

describe('deleting an event', () => {
  it('org_event_deleted tells everyone still registered, with the title as the body, and not a withdrawn registrant or the leader', async () => {
    const id = await event('Doomed build day')
    await adminClient().from('org_event_registrations').insert([
      { event_id: id, user_id: going.id, name: 'Going', email: 'going@example.com', answers: {} },
      { event_id: id, user_id: withdrew.id, name: 'W', email: 'w@example.com', answers: {}, cancelled_at: new Date().toISOString() },
      { event_id: id, user_id: leader.id, name: 'L', email: 'l@example.com', answers: {} },
    ])
    expect((await call(leader.token, 'DELETE', `/organizations/${orgId}/events/${id}`)).status).toBe(200)
    expect((await call(leader.token, 'DELETE', `/organizations/${orgId}/events/${id}`)).status).toBe(404)
    expect(await noticesFor(going.id, 'org_event_deleted')).toEqual([
      { type: 'org_event_deleted', actor_name: orgName, body: 'Doomed build day', org_id: orgId, org_event_id: null },
    ])
    expect(await noticesFor(withdrew.id, 'org_event_deleted')).toEqual([])
    expect(await noticesFor(leader.id, 'org_event_deleted')).toEqual([])
  })

  it('org_event_deleted tells a registrant who cancelled and registered again once', async () => {
    const id = await event('Twice build day')
    const form = { name: 'Going', email: 'going@example.com' }
    expect((await call(going.token, 'POST', `/events/${id}/registrations`, form)).status).toBe(201)
    expect((await call(going.token, 'DELETE', `/events/${id}/registrations`)).status).toBe(200)
    expect((await call(going.token, 'POST', `/events/${id}/registrations`, form)).status).toBe(201)
    expect((await call(leader.token, 'DELETE', `/organizations/${orgId}/events/${id}`)).status).toBe(200)
    const told = (await noticesFor(going.id, 'org_event_deleted')).filter((n) => n.body === 'Twice build day')
    expect(told).toHaveLength(1)
  })

  it('org_event_deleted sends nothing when nobody registered', async () => {
    const id = await event('Empty build day')
    expect((await call(leader.token, 'DELETE', `/organizations/${orgId}/events/${id}`)).status).toBe(200)
    const { count } = await adminClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('body', 'Empty build day')
    expect(count).toBe(0)
  })
})
