/**
 * The Member's and the host's sides of an event, through the real routes: the
 * public detail, "I'm going", "Can't make it", the confirm form, a part request
 * and the host's answer to it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'
import { notesAbout } from '../../helpers/notifications.js'

let leader: TestUser
let family: TestUser
let second: TestUser
let orgId: string
let freeEventId: string
let costedEventId: string
let printEventId: string
let questionId: string
let guideId: string
let partIds: string[] = []

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const send = (token: string, method: string, body: unknown = {}) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const detail = async (id: string, viewer?: string) =>
  (await (await app.request(`/api/public/events/${id}${viewer ? `?viewer=${viewer}` : ''}`)).json()) as Record<string, any>
const mine = async (token: string) =>
  ((await (await app.request('/api/events/mine', authed(token))).json()) as Array<{ event: { id: string } }>).map((r) => r.event.id)

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  second = await createTestUser('contributor')
  const admin = adminClient()
  orgId = await createOrg({ createdBy: leader.id, name: `Event journeys ${Date.now()}` })
  await addLeader(orgId, leader.id)
  await admin.from('organizations').update({
    pickup_line1: '1 Hall St', pickup_suburb: 'Crows Nest', pickup_state: 'NSW', pickup_postcode: '2065',
  }).eq('id', orgId)

  const event = async (over: Record<string, unknown>) =>
    (await admin.from('org_events').insert({
      org_id: orgId, kind: 'build_day', title: 'Journey day', format: 'in_person', location: 'A hall, 1 Test St',
      suburb: 'Crows Nest', state: 'NSW', status: 'published', created_by: leader.id,
      starts_at: new Date(Date.now() + 14 * 864e5).toISOString(), ...over,
    }).select('id').single()).data!.id as string
  freeEventId = await event({ title: 'Free day', capacity: 2 })
  costedEventId = await event({ title: 'Costed day', cost_cents: 1500, cost_note: 'Filament and tea' })
  printEventId = await event({ title: 'Parts day', prints_parts: true, part_sets_max: 4 })
  questionId = (await admin.from('org_event_questions').insert({
    event_id: costedEventId, position: 1, prompt: 'Which toy?', answer_type: 'short', required: true,
  }).select('id').single()).data!.id

  const { data: t } = await admin.from('tutorials').insert({ title: 'Event journey guide', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
  guideId = t!.id
  const { data: f } = await admin.from('stl_files').insert(
    ['a.stl', 'b.stl'].map((n) => ({ tutorial_id: guideId, filename: n, file_url: `${guideId}/${n}`, filament_grams: 10 })),
  ).select('id')
  partIds = (f ?? []).map((r: { id: string }) => r.id)
})

afterAll(async () => {
  const admin = adminClient()
  const { data: txs } = await admin.from('toy_transactions').select('id').eq('event_id', printEventId)
  const ids = (txs ?? []).map((t: { id: string }) => t.id)
  if (ids.length) {
    await admin.from('print_job_files').delete().in('transaction_id', ids)
    await admin.from('toy_transaction_messages').delete().in('transaction_id', ids)
    await admin.from('notifications').delete().in('toy_transaction_id', ids)
    await admin.from('toy_transactions').delete().in('id', ids)
  }
  const events = [freeEventId, costedEventId, printEventId]
  await admin.from('org_event_registrations').delete().in('event_id', events)
  await admin.from('org_event_questions').delete().in('event_id', events)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('tutorials').delete().eq('id', guideId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id), deleteTestUser(second.id)])
})

describe('the event detail, registering and cancelling', () => {
  it('V10 serves kind, place, cost, seats left and who is going, then full, closed and cancelled states', async () => {
    const fresh = await detail(freeEventId)
    expect(fresh).toMatchObject({
      kind: 'build_day', location: 'A hall, 1 Test St', suburb: 'Crows Nest', cost_cents: null,
      going_count: 0, seats_left: 2, cancelled_at: null, registrations_closed_at: null, online_url: null,
    })
    const costed = await detail(costedEventId)
    expect(costed).toMatchObject({ cost_cents: 1500, cost_note: 'Filament and tea', seats_left: null })

    const admin = adminClient()
    await admin.from('org_event_registrations').insert([
      { event_id: freeEventId, user_id: family.id, name: 'Priya Nair', email: 'p@example.com' },
      { event_id: freeEventId, user_id: second.id, name: 'Sam Lee', email: 's@example.com' },
    ])
    const full = await detail(freeEventId, family.id)
    expect(full).toMatchObject({ going_count: 2, seats_left: 0, viewer_going: true, attendee_initials: ['PN', 'SL'] })
    await admin.from('org_event_registrations').delete().eq('event_id', freeEventId)

    const now = new Date().toISOString()
    await admin.from('org_events').update({ registrations_closed_at: now }).eq('id', freeEventId)
    expect((await detail(freeEventId)).registrations_closed_at).not.toBeNull()
    await admin.from('org_events').update({ registrations_closed_at: null, cancelled_at: now }).eq('id', freeEventId)
    expect((await detail(freeEventId)).cancelled_at).not.toBeNull()
    await admin.from('org_events').update({ cancelled_at: null }).eq('id', freeEventId)
  })

  it('V11 registers with empty answers, raises the going count and lists it under My events', async () => {
    const res = await app.request(`/api/events/${freeEventId}/registrations`, send(family.token, 'POST', { name: 'Priya Nair', email: 'priya@example.com', answers: {} }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ event_id: freeEventId, user_id: family.id, name: 'Priya Nair', email: 'priya@example.com', answers: {}, cancelled_at: null })
    expect((await detail(freeEventId)).going_count).toBe(1)
    expect(await mine(family.token)).toContain(freeEventId)
  })

  it('V13 cancelling stamps cancelled_at, drops the going count and leaves My events', async () => {
    const res = await app.request(`/api/events/${freeEventId}/registrations`, { method: 'DELETE', ...authed(family.token) })
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('org_event_registrations').select('cancelled_at').eq('event_id', freeEventId).eq('user_id', family.id).single()
    expect(data!.cancelled_at).not.toBeNull()
    expect((await detail(freeEventId, family.id))).toMatchObject({ going_count: 0, seats_left: 2, viewer_going: false })
    expect(await mine(family.token)).not.toContain(freeEventId)
    const again = await app.request(`/api/events/${freeEventId}/registrations`, { method: 'DELETE', ...authed(family.token) })
    expect(again.status).toBe(404)
  })

  it('V16 a costed event is confirmed only with the cost acknowledged and the organiser question answered', async () => {
    const body = { name: 'Priya Nair', email: 'priya@example.com', answers: { [questionId]: 'Light-up penguin' } }
    const unacknowledged = await app.request(`/api/events/${costedEventId}/registrations`, send(family.token, 'POST', body))
    expect(unacknowledged.status).toBe(400)
    expect(await unacknowledged.json()).toEqual({ error: 'Tick the box to say you have read what this event costs.' })

    const unanswered = await app.request(`/api/events/${costedEventId}/registrations`, send(family.token, 'POST', { ...body, answers: {}, cost_acknowledged: true }))
    expect(unanswered.status).toBe(400)

    const ok = await app.request(`/api/events/${costedEventId}/registrations`, send(family.token, 'POST', { ...body, cost_acknowledged: true }))
    expect(ok.status).toBe(201)
    expect(await ok.json()).toMatchObject({ event_id: costedEventId, answers: { [questionId]: 'Light-up penguin' } })
    expect((await detail(costedEventId)).going_count).toBe(1)
    expect(await mine(family.token)).toContain(costedEventId)
  })

  it('V16 a full event answers with the server sentence and stores nothing', async () => {
    const admin = adminClient()
    await admin.from('org_events').update({ capacity: 1 }).eq('id', freeEventId)
    await admin.from('org_event_registrations').insert({ event_id: freeEventId, user_id: second.id, name: 'Sam Lee', email: 's@example.com' })
    const res = await app.request(`/api/events/${freeEventId}/registrations`, send(family.token, 'POST', { name: 'Priya Nair', email: 'priya@example.com', answers: {} }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'This one is full. The host may open more seats.' })
    const { data } = await admin.from('org_event_registrations').select('id').eq('event_id', freeEventId).eq('user_id', family.id).is('cancelled_at', null)
    expect(data).toEqual([])
  })
})

describe('part requests at an event', () => {
  let txId: string

  it('V17 sending a request stores the part request with its files and tells the host', async () => {
    const res = await app.request('/api/toy-transactions/print-at-event', send(family.token, 'POST', {
      event_id: printEventId, tutorial_id: guideId, stl_file_ids: partIds, part_sets: 2, note: 'Blue if you can',
    }))
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { id: string }
    txId = tx.id
    const { data: row } = await adminClient().from('toy_transactions')
      .select('type, status, event_id, owner_org_id, requester_id, part_sets, print_note, tutorial_id, printer_id').eq('id', txId).single()
    expect(row).toEqual({
      type: 'print', status: 'requested', event_id: printEventId, owner_org_id: orgId, requester_id: family.id,
      part_sets: 2, print_note: 'Blue if you can', tutorial_id: guideId, printer_id: null,
    })
    const { data: files } = await adminClient().from('print_job_files').select('stl_file_id').eq('transaction_id', txId)
    expect((files ?? []).map((f: { stl_file_id: string }) => f.stl_file_id).sort()).toEqual([...partIds].sort())
    const notes = await notesAbout(leader.id, txId)
    expect(notes.map((n) => [n.type, n.toy_name])).toEqual([['toy_request', 'Event journey guide']])
  })

  it('L32 the host reads the request in their owner list, the registrations and the questions', async () => {
    const list = (await (await app.request('/api/toy-transactions?role=owner', authed(leader.token))).json()) as Array<{ id: string; event_id: string | null; status: string }>
    expect(list.find((t) => t.id === txId)).toMatchObject({ event_id: printEventId, status: 'requested' })

    await adminClient().from('org_event_registrations').insert({ event_id: costedEventId, user_id: second.id, name: 'Sam Lee', email: 's@example.com', answers: { [questionId]: 'Switch toy' } })
    const regs = (await (await app.request(`/api/organizations/${orgId}/events/${costedEventId}/registrations`, authed(leader.token))).json()) as Array<{ name: string; answers: Record<string, unknown> }>
    expect(regs.map((r) => [r.name, r.answers[questionId]]).sort()).toEqual([['Priya Nair', 'Light-up penguin'], ['Sam Lee', 'Switch toy']])
    const qs = (await (await app.request(`/api/organizations/${orgId}/events/${costedEventId}/questions`, authed(leader.token))).json()) as Array<{ id: string; prompt: string }>
    expect(qs.map((q) => [q.id, q.prompt])).toEqual([[questionId, 'Which toy?']])
    const events = (await (await app.request(`/api/organizations/${orgId}/events`, authed(leader.token))).json()) as Array<{ id: string }>
    expect(events.map((e) => e.id)).toEqual(expect.arrayContaining([printEventId, costedEventId, freeEventId]))
  })

  it('L33 the host accepting moves the request to accepted and tells the family', async () => {
    const res = await app.request(`/api/toy-transactions/${txId}/accept`, send(leader.token, 'POST'))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('toy_transactions').select('status').eq('id', txId).single()
    expect(data!.status).toBe('accepted')
    const notes = await notesAbout(family.id, txId)
    expect(notes.map((n) => n.type)).toEqual(['toy_accepted'])
  })

  it('L34 the host declining stores the reason, tells the family, and needs a reason', async () => {
    const admin = adminClient()
    const { data: other } = await admin.from('toy_transactions').insert({
      toy_id: null, offered_toy_id: null, tutorial_id: guideId, printer_id: null, event_id: printEventId,
      part_sets: 1, type: 'print', status: 'requested', requester_id: second.id, owner_id: null, owner_org_id: orgId,
    }).select('id').single()
    const noReason = await app.request(`/api/toy-transactions/${other!.id}/reject`, send(leader.token, 'POST', {}))
    expect(noReason.status).toBe(400)
    expect(await noReason.json()).toEqual({ error: 'Say why you cannot take this job.' })

    const res = await app.request(`/api/toy-transactions/${other!.id}/reject`, send(leader.token, 'POST', { reason: 'Our machine is down' }))
    expect(res.status).toBe(200)
    const { data } = await admin.from('toy_transactions').select('status, decline_reason').eq('id', other!.id).single()
    expect(data).toEqual({ status: 'rejected', decline_reason: 'Our machine is down' })
    const notes = await notesAbout(second.id, other!.id)
    expect(notes.map((n) => [n.type, n.body])).toEqual([['toy_rejected', 'Our machine is down']])
    await admin.from('notifications').delete().eq('toy_transaction_id', other!.id)
    await admin.from('toy_transaction_messages').delete().eq('transaction_id', other!.id)
    await admin.from('toy_transactions').delete().eq('id', other!.id)
  })
})
