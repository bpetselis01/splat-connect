/**
 * "Also worth a look": automatic (the holder's other listed toys, newest first)
 * or hand-picked (up to three of their own toys and published guides). A pick
 * that stops being public drops out of the public read, and the picks reset
 * when the toy changes hands.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let holder: TestUser
let other: TestUser
let family: TestUser
let leader: TestUser
let orgId: string
const t: Record<string, string> = {}
let guide: string
let pendingGuide: string

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const insertToy = async (ownerId: string, name: string, created_at: string, status = 'published') =>
  (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name, condition: 8, photo_urls: ['https://example.com/t.jpg'], offer_type: 'donation', status, created_at })
      .select('id')
      .single()
  ).data!.id as string
const insertGuide = async (title: string, status: string) =>
  (
    await adminClient()
      .from('tutorials')
      .insert({ title, description: 'x', difficulty: 'easy', status, kind: 'assistive_tech' })
      .select('id')
      .single()
  ).data!.id as string
const publicPicks = async (id: string) =>
  ((await (await app.request(`/api/public/toys/${id}`)).json()) as { picks: Array<{ kind: string; id: string; title: string; meta: string | null }> }).picks

beforeAll(async () => {
  holder = await createTestUser('contributor')
  other = await createTestUser('contributor')
  family = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  t.a = await insertToy(holder.id, 'Drum', '2026-01-01T00:00:00Z')
  t.b = await insertToy(holder.id, 'Bubbles', '2026-02-01T00:00:00Z')
  t.c = await insertToy(holder.id, 'Fan', '2026-03-01T00:00:00Z')
  t.d = await insertToy(holder.id, 'Lights', '2026-04-01T00:00:00Z')
  t.draft = await insertToy(holder.id, 'Unfinished', '2026-05-01T00:00:00Z', 'draft')
  t.x = await insertToy(other.id, 'Not theirs', '2026-06-01T00:00:00Z')
  t.oa = await createOrgToy({ orgId, name: 'Shelf top', status: 'published' })
  t.ob = await createOrgToy({ orgId, name: 'Shelf drum', status: 'published' })
  guide = await insertGuide('Switch mount', 'approved')
  pendingGuide = await insertGuide('Still in review', 'pending')
})

afterAll(async () => {
  const admin = adminClient()
  const ids = Object.values(t)
  await admin.from('toy_transactions').delete().in('toy_id', ids)
  await admin.from('toys').delete().in('id', ids)
  await admin.from('tutorials').delete().in('id', [guide, pendingGuide])
  await cleanupOrg(orgId)
  for (const u of [holder, other, family, leader]) await deleteTestUser(u.id)
})

describe('102 toy picks', () => {
  it('has the column and the table', async () => {
    const admin = adminClient()
    expect((await admin.from('toys').select('picks_mode').limit(1)).error).toBeNull()
    expect((await admin.from('toy_picks').select('toy_id, position, entity_type, entity_id').limit(1)).error).toBeNull()
  })

  it("shows the holder's other listed toys, newest first, by default", async () => {
    const picks = await publicPicks(t.a)
    expect(picks.map((p) => p.id)).toEqual([t.d, t.c, t.b])
    expect(picks[0]).toMatchObject({ kind: 'toy', title: 'Lights', meta: 'Good' })
  })

  it('leaves a toy already spoken for out of the automatic picks', async () => {
    const admin = adminClient()
    const { data: tx } = await admin
      .from('toy_transactions')
      .insert({ toy_id: t.d, type: 'donation', status: 'accepted', requester_id: family.id, owner_id: holder.id, owner_code: '333333', requester_code: '444444' })
      .select('id')
      .single()
    expect((await publicPicks(t.a)).map((p) => p.id)).toEqual([t.c, t.b])
    await admin.from('toy_transactions').delete().eq('id', tx!.id)
  })

  it('refuses a mode that is not auto or picked', async () => {
    expect((await call(holder, `/api/toys/${t.a}`, 'PATCH', { picks_mode: 'sideways' })).status).toBe(400)
  })

  it('refuses picks that are not the holder’s to make', async () => {
    const put = (picks: unknown) => call(holder, `/api/toys/${t.a}/picks`, 'PUT', { picks })
    expect((await put([{ entity_type: 'toy', entity_id: t.x }])).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.a }])).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.draft }])).status).toBe(400)
    expect((await put([{ entity_type: 'tutorial', entity_id: pendingGuide }])).status).toBe(400)
    expect((await put([t.b, t.c, t.d, t.b].map((id) => ({ entity_type: 'toy', entity_id: id })))).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.b }, { entity_type: 'toy', entity_id: t.b }])).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: 'not-a-uuid' }])).status).toBe(400)
    expect((await put([{ entity_type: 'shelf', entity_id: t.b }])).status).toBe(400)
    expect((await call(other, `/api/toys/${t.a}/picks`, 'PUT', { picks: [] })).status).toBe(404)
  })

  it('shows the hand-picked ones in order, and drops one that stops being public', async () => {
    const res = await call(holder, `/api/toys/${t.a}/picks`, 'PUT', {
      picks: [{ entity_type: 'tutorial', entity_id: guide }, { entity_type: 'toy', entity_id: t.b }],
    })
    expect(res.status).toBe(200)
    expect((await call(holder, `/api/toys/${t.a}`, 'PATCH', { picks_mode: 'picked' })).status).toBe(200)
    expect(await publicPicks(t.a)).toEqual([
      { kind: 'assistive_tech', id: guide, title: 'Switch mount', photo_url: null, meta: null },
      { kind: 'toy', id: t.b, title: 'Bubbles', photo_url: 'https://example.com/t.jpg', meta: 'Good' },
    ])

    const mine = (await (await call(holder, '/api/toys', 'GET')).json()) as Array<{ id: string; toy_picks: unknown[] }>
    expect(mine.find((x) => x.id === t.a)?.toy_picks).toHaveLength(2)

    const admin = adminClient()
    await admin.from('toys').update({ status: 'draft' }).eq('id', t.b)
    expect((await publicPicks(t.a)).map((p) => p.id)).toEqual([guide])

    // A guide sent back to review drops out the same way.
    await admin.from('tutorials').update({ status: 'pending' }).eq('id', guide)
    expect(await publicPicks(t.a)).toEqual([])
    await admin.from('tutorials').update({ status: 'approved' }).eq('id', guide)
  })

  it("an organisation's retired toy drops from the public read and cannot be picked", async () => {
    const put = () => call(leader, `/api/toys/${t.oa}/picks`, 'PUT', { picks: [{ entity_type: 'toy', entity_id: t.ob }] })
    expect((await put()).status).toBe(200)
    expect((await call(leader, `/api/toys/${t.oa}`, 'PATCH', { picks_mode: 'picked' })).status).toBe(200)
    expect((await publicPicks(t.oa)).map((p) => p.id)).toEqual([t.ob])

    const inventory = (await (await call(leader, '/api/toys/inventory', 'GET')).json()) as Array<{ id: string; toy_picks: unknown[]; has_history: boolean }>
    expect(inventory.find((x) => x.id === t.oa)).toMatchObject({ has_history: false, toy_picks: [{ position: 1, entity_type: 'toy', entity_id: t.ob }] })

    await adminClient().from('toys').update({ retired_at: new Date().toISOString() }).eq('id', t.ob)
    expect(await publicPicks(t.oa)).toEqual([])
    expect((await put()).status).toBe(400)

    // Nor does automatic mode suggest it.
    expect((await call(leader, `/api/toys/${t.oa}`, 'PATCH', { picks_mode: 'auto' })).status).toBe(200)
    expect(await publicPicks(t.oa)).toEqual([])
  })

  it('goes back to automatic, with no picks, when the toy changes hands', async () => {
    const { data: tx } = await adminClient()
      .from('toy_transactions')
      .insert({ toy_id: t.a, type: 'donation', status: 'accepted', requester_id: family.id, owner_id: holder.id, owner_code: '111111', requester_code: '222222' })
      .select('id')
      .single()
    expect((await call(holder, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '222222' })).status).toBe(200)
    const admin = adminClient()
    const { data: moved } = await admin.from('toys').select('owner_id, picks_mode').eq('id', t.a).single()
    expect(moved).toEqual({ owner_id: family.id, picks_mode: 'auto' })
    const { count } = await admin.from('toy_picks').select('toy_id', { count: 'exact', head: true }).eq('toy_id', t.a)
    expect(count).toBe(0)
  })
})

describe('102 hand-picked toys stay the holder’s own, and requestable', () => {
  let tx: string
  beforeAll(async () => {
    t.h = await insertToy(holder.id, 'Rattle', '2026-07-01T00:00:00Z')
    t.p2 = await insertToy(holder.id, 'Chime', '2026-07-02T00:00:00Z')
    t.p3 = await insertToy(holder.id, 'Spinner', '2026-07-03T00:00:00Z')
    t.p4 = await insertToy(holder.id, 'Bell', '2026-07-04T00:00:00Z')
    const put = await call(holder, `/api/toys/${t.h}/picks`, 'PUT', {
      picks: [t.p2, t.p3, t.p4].map((id) => ({ entity_type: 'toy', entity_id: id })),
    })
    expect(put.status).toBe(200)
    expect((await call(holder, `/api/toys/${t.h}`, 'PATCH', { picks_mode: 'picked' })).status).toBe(200)
    expect((await publicPicks(t.h)).map((p) => p.id)).toEqual([t.p2, t.p3, t.p4])
  })

  it('drops a hand-picked toy already spoken for', async () => {
    const { data } = await adminClient()
      .from('toy_transactions')
      .insert({ toy_id: t.p4, type: 'donation', status: 'accepted', requester_id: family.id, owner_id: holder.id, owner_code: '555555', requester_code: '666666' })
      .select('id')
      .single()
    tx = data!.id
    expect((await publicPicks(t.h)).map((p) => p.id)).toEqual([t.p2, t.p3])
  })

  it('drops a hand-picked toy that changed hands, even once its new holder lists it', async () => {
    expect((await call(holder, `/api/toy-transactions/${tx}/confirm`, 'POST', { code: '666666' })).status).toBe(200)
    const admin = adminClient()
    await admin.from('toys').update({ status: 'published' }).eq('id', t.p4)
    expect((await publicPicks(t.h)).map((p) => p.id)).toEqual([t.p2, t.p3])
    const { count } = await admin.from('toy_picks').select('toy_id', { count: 'exact', head: true }).eq('entity_id', t.p4)
    expect(count).toBe(0)
  })

  it("ignores a pick row naming a stranger's toy, however it was written", async () => {
    const admin = adminClient()
    await admin.from('toy_picks').delete().eq('toy_id', t.h).eq('position', 3)
    const { error } = await admin.from('toy_picks').insert({ toy_id: t.h, position: 3, entity_type: 'toy', entity_id: t.x })
    expect(error).toBeNull()
    expect((await publicPicks(t.h)).map((p) => p.id)).toEqual([t.p2, t.p3])
  })
})
