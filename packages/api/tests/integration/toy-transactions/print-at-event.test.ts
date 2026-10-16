/**
 * POST /api/toy-transactions/print-at-event: a family asks an event's host to
 * print a guide's parts before the day. It is the same row as a job sent to a
 * printer, so the host's accept/reject work on it unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let eventId: string
let noPrintEventId: string
let guideId: string
let otherGuideId: string
let partIds: string[] = []
let otherPartId: string

const post = (token: string | null, body: unknown) =>
  app.request('/api/toy-transactions/print-at-event', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const valid = () => ({ event_id: eventId, tutorial_id: guideId, stl_file_ids: [partIds[0]], part_sets: 1, note: 'Blue if you can' })

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  const admin = adminClient()
  orgId = await createOrg({ createdBy: leader.id, name: `Print-at-event ${Date.now()}` })
  await addLeader(orgId, leader.id)

  const event = (printsParts: boolean) =>
    admin
      .from('org_events')
      .insert({
        org_id: orgId, kind: 'build_day', title: printsParts ? 'Printing day' : 'Talking day',
        starts_at: new Date(Date.now() + 14 * 864e5).toISOString(), format: 'in_person',
        location: 'A hall', suburb: 'Crows Nest', state: 'NSW', status: 'published',
        prints_parts: printsParts, part_sets_max: 2, created_by: leader.id,
      })
      .select('id')
      .single()
  eventId = (await event(true)).data!.id
  noPrintEventId = (await event(false)).data!.id

  const guide = async (title: string, files: string[]) => {
    const { data: t } = await admin.from('tutorials').insert({ title, description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
    const { data: f } = await admin
      .from('stl_files')
      .insert(files.map((n) => ({ tutorial_id: t!.id, filename: n, file_url: `${t!.id}/${n}`, filament_grams: 10 })))
      .select('id')
    return { id: t!.id as string, parts: (f ?? []).map((r: { id: string }) => r.id) }
  }
  const a = await guide('Print-at-event guide', ['a.stl', 'b.stl'])
  const b = await guide('Print-at-event other guide', ['c.stl'])
  guideId = a.id
  partIds = a.parts
  otherGuideId = b.id
  otherPartId = b.parts[0]
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
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('tutorials').delete().in('id', [guideId, otherGuideId])
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id)])
})

describe('POST /api/toy-transactions/print-at-event', () => {
  it('refuses a signed-out caller', async () => {
    expect((await post(null, valid())).status).toBe(401)
  })

  it('names the missing parts when none are ticked', async () => {
    const res = await post(family.token, { ...valid(), stl_file_ids: [] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Tick at least one part to print.' })
  })

  it('refuses a part that belongs to another guide', async () => {
    const res = await post(family.token, { ...valid(), stl_file_ids: [partIds[0], otherPartId] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Those parts do not all belong to that guide' })
  })

  it('refuses an organisation leader asking their own organisation', async () => {
    const res = await post(leader.token, valid())
    expect(res.status).toBe(400)
  })

  it('refuses an event that does not print parts', async () => {
    const res = await post(family.token, { ...valid(), event_id: noPrintEventId })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'This host is not printing parts before the day.' })
  })

  it('refuses more sets than a single request may ask', async () => {
    expect((await post(family.token, { ...valid(), part_sets: 21 })).status).toBe(400)
  })

  it('creates a requested print owned by the event host, and refuses a second open one', async () => {
    const res = await post(family.token, { ...valid(), stl_file_ids: partIds, part_sets: 2 })
    expect(res.status).toBe(201)
    const tx = (await res.json()) as Record<string, unknown>
    expect(tx).toMatchObject({ type: 'print', status: 'requested', event_id: eventId, owner_org_id: orgId, requester_id: family.id, part_sets: 2, printer_id: null })

    const { data: files } = await adminClient().from('print_job_files').select('stl_file_id').eq('transaction_id', tx.id as string)
    expect((files ?? []).map((f: { stl_file_id: string }) => f.stl_file_id).sort()).toEqual([...partIds].sort())

    const again = await post(family.token, valid())
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: 'You already have a part request open with this host' })
  })

  it('shows the request in the family\'s My events and lets only the host accept it', async () => {
    const mine = await app.request('/api/events/mine', { headers: { Authorization: `Bearer ${family.token}` } })
    expect(mine.status).toBe(200)
    const { data: tx } = await adminClient().from('toy_transactions').select('id').eq('requester_id', family.id).eq('event_id', eventId).single()
    const accept = await app.request(`/api/toy-transactions/${tx!.id}/accept`, {
      method: 'POST', headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' }, body: '{}',
    })
    expect(accept.status).toBe(403)
  })
})
