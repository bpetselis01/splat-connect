/**
 * 117 — thanking a person. Only the count is public; the note is the thanker's
 * and the thanked person's; a hide is the thanked person's and the thanker can
 * never undo it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const userClient = (token: string) =>
  createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
const anon = () => createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')

let maker: TestUser
let family: TestUser
let stranger: TestUser
let tutorialId: string
let txId: string
let orgId: string
let orgTxId: string

const post = (token: string, id: string, body: unknown = {}) =>
  app.request(`/api/contributors/${id}/thanks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  const admin = adminClient()
  ;[maker, family, stranger] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  // The maker needs something public, or their showcase 404s.
  const { data: t } = await admin.from('tutorials').insert({ title: 'Drum', difficulty: 'easy', status: 'approved' }).select('id').single()
  tutorialId = t!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'primary' })
  const { data: tx } = await admin
    .from('toy_transactions')
    .insert({ type: 'build', status: 'completed', tutorial_id: tutorialId, build_brief: 'For Leo.', requester_id: family.id, owner_id: maker.id })
    .select('id')
    .single()
  txId = tx!.id
  // An organisation's build: the stranger leads the org that made it for the family.
  orgId = (await admin.from('organizations').insert({ name: `Thanks ${Date.now()}`, status: 'active' }).select('id').single()).data!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: stranger.id })
  const { data: orgTx } = await admin
    .from('toy_transactions')
    .insert({ type: 'build', status: 'completed', tutorial_id: tutorialId, build_brief: 'For Mia.', requester_id: family.id, owner_org_id: orgId })
    .select('id')
    .single()
  orgTxId = orgTx!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().in('recipient_id', [maker.id, family.id, stranger.id])
  await admin.from('toy_transactions').delete().in('id', [txId, orgTxId])
  await admin.from('organizations').delete().eq('id', orgId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([maker, family, stranger].map((u) => deleteTestUser(u.id)))
})

describe('117 profile thanks', () => {
  it('the table and the count function exist', async () => {
    const { error } = await adminClient().from('profile_thanks').select('profile_id, thanker_id, note, byline, show_note, hidden_at, transaction_id').limit(1)
    expect(error).toBeNull()
    const { error: countError } = await adminClient().from('profiles').select('profile_thanks_count').eq('id', maker.id).single()
    expect(countError).toBeNull()
  })

  it('refuses a transaction the two were never party to, and thanking yourself', async () => {
    expect((await post(stranger.token, maker.id, { transaction_id: txId })).status).toBe(400)
    expect((await post(maker.token, maker.id)).status).toBe(403)
    // Leading the org that made the build is not being party to the maker's.
    expect((await post(stranger.token, family.id, { transaction_id: txId })).status).toBe(400)
  })

  it('lets a leader of the organisation that held the toy thank the family for it', async () => {
    expect((await post(stranger.token, family.id, { transaction_id: orgTxId })).status).toBe(201)
    const { data } = await adminClient().from('profile_thanks').select('transaction_id').eq('profile_id', family.id).eq('thanker_id', stranger.id).single()
    expect(data!.transaction_id).toBe(orgTxId)
  })

  it('R11 S02 takes one thanks per person, tied to the build, and tells the maker on the build (profile_thanked)', async () => {
    const res = await post(family.token, maker.id, { note: 'Leo loves it.', byline: 'Sam', transaction_id: txId })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { thanks_count: number }).thanks_count).toBe(1)
    expect((await post(family.token, maker.id)).status).toBe(409)

    const { data: n } = await adminClient().from('notifications').select('*').eq('recipient_id', maker.id).eq('type', 'profile_thanked')
    expect(n).toHaveLength(1)
    expect(n![0]).toMatchObject({ toy_transaction_id: txId, profile_id: null, actor_name: 'Sam' })
  })

  it('X13 WP04 a showcase thanks carries the person as its subject', async () => {
    expect((await post(stranger.token, maker.id)).status).toBe(201)
    const { data: n } = await adminClient()
      .from('notifications')
      .select('profile_id, toy_transaction_id, actor_name')
      .eq('recipient_id', maker.id)
      .eq('type', 'profile_thanked')
      .is('toy_transaction_id', null)
    expect(n![0]).toMatchObject({ profile_id: maker.id, actor_name: 'A family' })
  })

  it('S02 WP04 lets nobody but the two read the note; anon reads the count only', async () => {
    const third = await userClient(stranger.token).from('profile_thanks').select('note').eq('thanker_id', family.id)
    expect(third.data ?? []).toEqual([])
    const own = await userClient(family.token).from('profile_thanks').select('note').eq('thanker_id', family.id)
    expect(own.data).toEqual([{ note: 'Leo loves it.' }])
    const thanked = await userClient(maker.token).from('profile_thanks').select('note').eq('profile_id', maker.id)
    expect(thanked.data?.length).toBe(2)
    const viaAnon = await anon().from('profile_thanks').select('note')
    expect(viaAnon.error ?? viaAnon.data?.length === 0).toBeTruthy()

    const raw = await (await app.request(`/api/public/contributors/${maker.id}`)).text()
    expect(raw).not.toContain('Leo loves it.')
    expect((JSON.parse(raw) as { thanks: number }).thanks).toBe(2)
  })

  it('lets the thanked person hide a note, and the thanker can never un-hide it', async () => {
    const hide = await app.request(`/api/contributors/me/thanks/${family.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${maker.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: true }),
    })
    expect(hide.status).toBe(200)
    const undo = await userClient(family.token).from('profile_thanks').update({ hidden_at: null }).eq('thanker_id', family.id).eq('profile_id', maker.id)
    expect(undo.error?.code).toBe('42501')
    // Nor point the thanks at an exchange the API never checked.
    const retarget = await userClient(family.token).from('profile_thanks').update({ transaction_id: null }).eq('thanker_id', family.id).eq('profile_id', maker.id)
    expect(retarget.error?.code).toBe('42501')
    const { data } = await adminClient().from('profile_thanks').select('hidden_at').eq('thanker_id', family.id).single()
    expect(data!.hidden_at).not.toBeNull()
  })
})
