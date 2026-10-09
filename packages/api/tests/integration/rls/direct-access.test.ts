/**
 * Row-level security, past the API. Every other integration test goes through
 * the Hono handlers, which can mask a wrong policy: the handler may filter, or
 * use the service role. Here each caller talks to PostgREST with only their own
 * token (or none), the way a leaked key or a hand-written request would.
 *
 * Rules with teeth:
 *  - A child's profile is readable and writable only by its parent.
 *  - A notification is readable only by its recipient.
 *  - An open build request is readable by signed-in users and NEVER by anon (064).
 *  - Once a maker claims a build, only the family and that maker can see it.
 *  - Pickup addresses are denied to every direct caller, the owner included (028).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const KEY = process.env.SUPABASE_ANON_KEY ?? ''
const as = (u: TestUser | null) =>
  createClient(URL, KEY, u ? { global: { headers: { Authorization: `Bearer ${u.token}` } } } : {})

let family: TestUser
let maker: TestUser
let outsider: TestUser
let tutorialId: string
let childId: string
let noteId: string
let openBuildId: string
let claimedBuildId: string

beforeAll(async () => {
  ;[family, maker, outsider] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('contributor'),
  ])
  const db = adminClient()
  await db.from('profiles').update({ pickup_line1: '1 Secret St', pickup_suburb: 'Newtown' }).eq('id', family.id)

  const t = await db.from('tutorials').insert({ title: `RLS ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()
  if (t.error) throw t.error
  tutorialId = t.data.id

  const c = await db.from('child_profiles').insert({ parent_id: family.id, name: 'Zed', age: 6 }).select('id').single()
  if (c.error) throw c.error
  childId = c.data.id

  const n = await db
    .from('notifications')
    .insert({ recipient_id: family.id, type: 'tutorial_approved', tutorial_id: tutorialId, actor_name: 'Admin' })
    .select('id')
    .single()
  if (n.error) throw n.error
  noteId = n.data.id

  const base = { type: 'build', tutorial_id: tutorialId, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown' }
  const open = await db.from('toy_transactions').insert({ ...base, status: 'requested' }).select('id').single()
  if (open.error) throw open.error
  openBuildId = open.data.id
  const claimed = await db.from('toy_transactions').insert({ ...base, status: 'accepted', owner_id: maker.id }).select('id').single()
  if (claimed.error) throw claimed.error
  claimedBuildId = claimed.data.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('notifications').delete().eq('id', noteId)
  await db.from('toy_transactions').delete().in('id', [openBuildId, claimedBuildId])
  await db.from('child_profiles').delete().eq('id', childId)
  await db.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, maker, outsider].map((u) => deleteTestUser(u.id)))
})

describe("a child's profile", () => {
  it('is visible to the parent', async () => {
    const { data } = await as(family).from('child_profiles').select('id').eq('id', childId)
    expect(data).toHaveLength(1)
  })
  it.each([
    ['another member', () => as(outsider)],
    ['an anonymous caller', () => as(null)],
  ])('is invisible to %s', async (_n, client) => {
    const { data } = await client().from('child_profiles').select('id').eq('id', childId)
    expect(data ?? []).toHaveLength(0)
  })
  it('cannot be changed or deleted by another member', async () => {
    await as(outsider).from('child_profiles').update({ name: 'Hacked' }).eq('id', childId)
    await as(outsider).from('child_profiles').delete().eq('id', childId)
    const { data } = await adminClient().from('child_profiles').select('name').eq('id', childId)
    expect(data).toEqual([{ name: 'Zed' }])
  })
})

describe('a notification', () => {
  it('is visible to its recipient', async () => {
    const { data } = await as(family).from('notifications').select('id').eq('id', noteId)
    expect(data).toHaveLength(1)
  })
  it.each([
    ['another member', () => as(outsider)],
    ['an anonymous caller', () => as(null)],
  ])('is invisible to %s', async (_n, client) => {
    const { data } = await client().from('notifications').select('id').eq('id', noteId)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('build requests', () => {
  it('an open request is readable by a signed-in member (064, by design)', async () => {
    const { data } = await as(outsider).from('toy_transactions').select('id').eq('id', openBuildId)
    expect(data).toHaveLength(1)
  })
  it('an open request is never readable anonymously', async () => {
    const { data } = await as(null).from('toy_transactions').select('id').eq('id', openBuildId)
    expect(data ?? []).toHaveLength(0)
  })
  it('a claimed build is visible to the family and the maker only', async () => {
    const seen = async (u: TestUser | null) =>
      ((await as(u).from('toy_transactions').select('id').eq('id', claimedBuildId)).data ?? []).length
    expect(await seen(family)).toBe(1)
    expect(await seen(maker)).toBe(1)
    expect(await seen(outsider)).toBe(0)
    expect(await seen(null)).toBe(0)
  })
})

describe('a pickup address', () => {
  // 028 revokes the column from anon and authenticated: nobody reads it through PostgREST,
  // the owner included. It is read only by the API, through the service client. The test
  // asserts the permission error (42501), not an empty result, so it cannot pass by accident.
  it.each([
    ['its owner', () => as(family)],
    ['another member', () => as(outsider)],
    ['an anonymous caller', () => as(null)],
  ])('is denied to %s', async (_n, client) => {
    const { data, error } = await client().from('profiles').select('pickup_line1').eq('id', family.id)
    expect(data ?? null).toBeNull()
    expect(error?.code).toBe('42501')
  })
})
