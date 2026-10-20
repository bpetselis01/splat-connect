/**
 * Acknowledgements (142): what a signed-in person sends is answered in their
 * own inbox. Each `it` title names its type for scripts/journeys/notifications.mjs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DECLARATION_VERSION } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const call = (token: string | null, method: string, path: string, body?: unknown) =>
  app.request(`http://localhost/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

let member: TestUser
let leader: TestUser
let orgId: string
let eventId: string
const orgName = `Ack Org ${Date.now()}`

async function noticesFor(recipient: string, type: string) {
  const { data } = await adminClient()
    .from('notifications')
    .select('type, actor_name, body, tutorial_title, org_id, org_event_id, idea_id, member_report_id')
    .eq('recipient_id', recipient)
    .eq('type', type)
  return data ?? []
}

const subjects = { org_id: null, org_event_id: null, idea_id: null, member_report_id: null }

beforeAll(async () => {
  ;[member, leader] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const sb = adminClient()
  const { data: org } = await sb
    .from('organizations')
    .insert({ name: orgName, status: 'active', recycling_materials: ['PLA'] })
    .select('id')
    .single()
  orgId = org!.id
  await sb.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
  const { data: event } = await sb
    .from('org_events')
    .insert({
      org_id: orgId, created_by: leader.id, title: 'Ack build day', kind: 'build_day', format: 'in_person',
      location: '1 Test St', suburb: 'Crows Nest', state: 'NSW', audience: 'Families', status: 'published',
      starts_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    })
    .select('id')
    .single()
  eventId = event!.id
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('contact_messages').delete().eq('sender_id', member.id)
  await sb.from('toy_ideas').delete().eq('author_id', member.id)
  await sb.from('member_reports').delete().eq('reporter_id', member.id)
  await sb.from('recycling_dropoffs').delete().eq('org_id', orgId)
  await sb.from('org_event_registrations').delete().eq('event_id', eventId)
  await sb.from('org_events').delete().eq('id', eventId)
  await sb.from('org_leaders').delete().eq('org_id', orgId)
  await sb.from('organizations').delete().eq('id', orgId)
  await Promise.all([member, leader].map((u) => deleteTestUser(u.id)))
})

describe('acknowledged submissions', () => {
  it('event_rsvp_received confirms the registration once, however often the form is saved', async () => {
    const form = { name: 'Mia', email: 'mia@example.com' }
    expect((await call(member.token, 'POST', `/events/${eventId}/registrations`, form)).status).toBe(201)
    expect((await call(member.token, 'POST', `/events/${eventId}/registrations`, form)).status).toBe(201)
    expect(await noticesFor(member.id, 'event_rsvp_received')).toEqual([
      { ...subjects, type: 'event_rsvp_received', actor_name: orgName, body: null, tutorial_title: 'Ack build day', org_event_id: eventId },
    ])
  })

  it('idea_received names the idea in the body and points at it', async () => {
    const res = await call(member.token, 'POST', '/ideas', { title: 'A bubble machine', summary: 'One-press bubbles.' })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    expect(await noticesFor(member.id, 'idea_received')).toEqual([
      { ...subjects, type: 'idea_received', actor_name: 'SPLAT', body: 'A bubble machine', tutorial_title: '', idea_id: id },
    ])
  })

  it('report_received names what was reported in the body and points at the report', async () => {
    const res = await call(member.token, 'POST', '/reports', {
      subject_kind: 'guide', subject_label: 'Spoon Holder', category: 'wrong_info', body: 'The step 3 photo is the wrong part.',
    })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    expect(await noticesFor(member.id, 'report_received')).toEqual([
      { ...subjects, type: 'report_received', actor_name: 'SPLAT', body: 'Spoon Holder', tutorial_title: '', member_report_id: id },
    ])
  })

  it('drop_off_booked confirms the booking in the organisation’s name', async () => {
    const res = await call(member.token, 'POST', `/organizations/${orgId}/recycling`, {
      material: 'PLA', estimated_grams: 3000, condition_declared: true, declaration_version: DECLARATION_VERSION,
    })
    expect(res.status).toBe(201)
    expect(await noticesFor(member.id, 'drop_off_booked')).toEqual([
      { ...subjects, type: 'drop_off_booked', actor_name: orgName, body: null, tutorial_title: '', org_id: orgId },
    ])
  })

  it('contact_received answers a signed-in sender and records them, and an anonymous sender gets a 201 and no notification', async () => {
    const email = `mia+${Date.now()}@example.com`
    const form = { topic: 'other', name: 'Mia', email, body: 'The battery pack gets warm' }
    expect((await call(member.token, 'POST', '/public/contact', form)).status).toBe(201)
    expect((await call(null, 'POST', '/public/contact', form)).status).toBe(201)
    expect(await noticesFor(member.id, 'contact_received')).toEqual([
      { ...subjects, type: 'contact_received', actor_name: 'SPLAT', body: 'The battery pack gets warm', tutorial_title: '' },
    ])
    const { data } = await adminClient().from('contact_messages').select('sender_id').eq('email', email)
    expect((data ?? []).map((r) => r.sender_id).sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
      [member.id, null].sort((a, b) => String(a).localeCompare(String(b)))
    )
    await adminClient().from('contact_messages').delete().eq('email', email)
  })
})
