/**
 * What an organisation leader's publishing screens write and whom they tell:
 * publishing a draft event, creating a published story, removing an event that
 * people registered for, the event's cost, and the host answering a part request.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser, notesAbout } from '../../helpers/notifications.js'
import { addLeader, cleanupOrg, createOrg, setOrgPickup } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let registrant: TestUser
let orgId: string
let guideId: string
let partId: string

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const notices = async (userId: string, type: string) =>
  ((await adminClient().from('notifications').select('*').eq('recipient_id', userId).eq('type', type)).data ?? []) as Array<Record<string, any>>

const newEvent = async (over: Record<string, unknown> = {}) => {
  const { data, error } = await adminClient()
    .from('org_events')
    .insert({
      org_id: orgId, created_by: leader.id, kind: 'build_day', title: `Event ${crypto.randomUUID().slice(0, 6)}`,
      starts_at: new Date(Date.now() + 14 * 864e5).toISOString(), format: 'in_person', location: 'A hall',
      suburb: 'Newtown', state: 'NSW', audience: 'Families', status: 'draft', ...over,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`event seed failed: ${error?.message}`)
  return data.id as string
}

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  registrant = await createTestUser('contributor')
  await nameUser(family.id, 'Fran Family')
  orgId = await createOrg({ createdBy: leader.id, name: 'Publishing Org' })
  await addLeader(orgId, leader.id)
  await setOrgPickup(orgId)
  expect((await call(family, `/organizations/${orgId}/follow`, 'POST')).status).toBe(200)
  const admin = adminClient()
  const { data: guide } = await admin.from('tutorials').insert({ title: 'Event cradle', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
  guideId = guide!.id
  const { data: part } = await admin.from('stl_files').insert({ tutorial_id: guideId, filename: 'cradle.stl', file_url: `${guideId}/cradle.stl`, filament_grams: 10 }).select('id').single()
  partId = part!.id
})

afterAll(async () => {
  const admin = adminClient()
  const { data: txs } = await admin.from('toy_transactions').select('id').eq('requester_id', family.id)
  const ids = (txs ?? []).map((t: { id: string }) => t.id)
  if (ids.length) {
    await admin.from('print_job_files').delete().in('transaction_id', ids)
    await admin.from('toy_transaction_messages').delete().in('transaction_id', ids)
    await admin.from('notifications').delete().in('toy_transaction_id', ids)
    await admin.from('toy_transactions').delete().in('id', ids)
  }
  await admin.from('notifications').delete().in('recipient_id', [family.id, registrant.id])
  await admin.from('tutorials').delete().eq('id', guideId)
  await cleanupOrg(orgId)
  for (const u of [leader, family, registrant]) await deleteTestUser(u.id)
})

describe('publishing a draft event', () => {
  it('WB16 tells a follower once when a draft is published, and nobody when it is unpublished again', async () => {
    const id = await newEvent({ title: 'Published from draft' })
    expect((await call(leader, `/organizations/${orgId}/events/${id}`, 'PATCH', { status: 'published' })).status).toBe(200)
    const first = (await notices(family.id, 'org_event_published')).filter((n) => n.org_event_id === id)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ tutorial_title: 'Published from draft', actor_name: 'Publishing Org' })

    expect((await call(leader, `/organizations/${orgId}/events/${id}`, 'PATCH', { status: 'draft' })).status).toBe(200)
    expect((await notices(family.id, 'org_event_published')).filter((n) => n.org_event_id === id)).toHaveLength(1)
    const public_ = (await (await app.request('/api/public/events')).json()) as Array<{ id: string }>
    expect(public_.map((e) => e.id)).not.toContain(id)
  })

  it('WB20 tells a follower when the edit form’s whole-event PATCH turns a draft into a published event', async () => {
    const id = await newEvent({ title: 'Edited into publication' })
    const res = await call(leader, `/organizations/${orgId}/events/${id}`, 'PATCH', {
      title: 'Edited into publication (moved)', kind: 'build_day', starts_at: new Date(Date.now() + 14 * 864e5).toISOString(),
      format: 'in_person', location: 'A hall', suburb: 'Newtown', state: 'NSW', audience: 'Families', status: 'published',
    })
    expect(res.status).toBe(200)
    const [note] = (await notices(family.id, 'org_event_published')).filter((n) => n.org_event_id === id)
    expect(note.tutorial_title).toBe('Edited into publication (moved)')
  })
})

describe('creating a published story', () => {
  it('WB25 tells a follower when a story is created already published', async () => {
    const res = await call(leader, `/organizations/${orgId}/stories`, 'POST', {
      kind: 'family', title: 'Straight to published', summary: 'One line.', body: 'The story.', byline: 'The club',
      consent_confirmed: true, status: 'published',
    })
    expect(res.status).toBe(201)
    const id = ((await res.json()) as { id: string }).id
    const [note] = (await notices(family.id, 'org_story_published')).filter((n) => n.org_story_id === id)
    expect(note).toMatchObject({ tutorial_title: 'Straight to published', actor_name: 'Publishing Org' })
  })
})

describe('removing an event people registered for', () => {
  it('WB17 deletes the event and its registrations and tells the registrant it is gone (org_event_deleted)', async () => {
    const id = await newEvent({ status: 'published', title: 'Removed with registrants' })
    await adminClient().from('org_event_registrations').insert({ event_id: id, user_id: registrant.id, name: 'Reg', email: 'reg@example.com', answers: {} })
    const res = await call(leader, `/organizations/${orgId}/events/${id}`, 'DELETE')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { id: string }).id).toBe(id)
    expect((await adminClient().from('org_events').select('id').eq('id', id)).data).toEqual([])
    expect((await adminClient().from('org_event_registrations').select('id').eq('event_id', id)).data).toEqual([])
    const told = ((await adminClient().from('notifications').select('type, body').eq('recipient_id', registrant.id)).data ?? []) as Array<{ type: string; body: string | null }>
    expect(told).toEqual([{ type: 'org_event_deleted', body: 'Removed with registrants' }])
  })
})

describe('the event cost', () => {
  it('WB22 stores the cost and its breakdown, and tells the registered nothing', async () => {
    const id = await newEvent({ status: 'published' })
    await adminClient().from('org_event_registrations').insert({ event_id: id, user_id: registrant.id, name: 'Reg', email: 'reg@example.com', answers: {} })
    const res = await call(leader, `/organizations/${orgId}/events/${id}`, 'PATCH', { cost_cents: 1250, cost_note: 'Kits at cost' })
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('org_events').select('cost_cents, cost_note').eq('id', id).single()
    expect(data).toEqual({ cost_cents: 1250, cost_note: 'Kits at cost' })
    expect(await notices(registrant.id, 'org_event_changed')).toEqual([])
  })

  it('WB22 refuses another organisation’s leader', async () => {
    const id = await newEvent({ status: 'published' })
    const stranger = await createTestUser('contributor')
    try {
      const res = await call(stranger, `/organizations/${orgId}/events/${id}`, 'PATCH', { cost_cents: 5 })
      expect([403, 404]).toContain(res.status)
      expect((await adminClient().from('org_events').select('cost_cents').eq('id', id).single()).data!.cost_cents).toBeNull()
    } finally {
      await deleteTestUser(stranger.id)
    }
  })
})

describe('the host answering a part request', () => {
  const ask = async (eventId: string) => {
    const res = await call(family, '/toy-transactions/print-at-event', 'POST', {
      event_id: eventId, tutorial_id: guideId, stl_file_ids: [partId], part_sets: 1,
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }

  it('WB23 accepting tells the family, and the request leaves the host’s open list', async () => {
    const eventId = await newEvent({ status: 'published', prints_parts: true, part_sets_max: 2, title: 'Accepting day' })
    const txId = await ask(eventId)
    const res = await call(leader, `/toy-transactions/${txId}/accept`, 'POST', {})
    expect(res.status).toBe(200)
    expect((await adminClient().from('toy_transactions').select('status').eq('id', txId).single()).data!.status).toBe('accepted')
    expect(await notesAbout(family.id, txId)).toEqual([expect.objectContaining({ type: 'toy_accepted' })])
  })

  it('WB23 declining stores the reason, tells the family, and needs the reason', async () => {
    const eventId = await newEvent({ status: 'published', prints_parts: true, part_sets_max: 2, title: 'Declining day' })
    const txId = await ask(eventId)
    expect((await call(leader, `/toy-transactions/${txId}/reject`, 'POST', {})).status).toBe(400)
    const res = await call(leader, `/toy-transactions/${txId}/reject`, 'POST', { reason: 'Bed is booked.' })
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('toy_transactions').select('status, decline_reason').eq('id', txId).single()
    expect(data).toEqual({ status: 'rejected', decline_reason: 'Bed is booked.' })
    expect(await notesAbout(family.id, txId)).toEqual([expect.objectContaining({ type: 'toy_rejected' })])
  })
})
