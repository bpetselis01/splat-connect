/**
 * 111: before claiming, a maker asks the family privately. One thread per
 * (request, maker): the family reads every thread, a maker only their own.
 * Asking stops at the claim, and the claimer's questions move into the build
 * thread.
 */
// journeys: K03 K04 X01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let makerA: TestUser
let makerB: TestUser
let tutorialId: string
let txId: string

const ask = (u: TestUser, body: object) =>
  app.request(`/api/toy-transactions/${txId}/questions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const read = async (u: TestUser) => app.request(`/api/toy-transactions/${txId}/questions`, { headers: { Authorization: `Bearer ${u.token}` } })
/** The caller's own PostgREST view, past the API: 111's policy alone. */
const direct = (u: TestUser) =>
  createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${u.token}` } },
  })
type Q = { open: boolean; family: boolean; threads: { maker_id: string; messages: { body: string }[] }[] }

beforeAll(async () => {
  ;[family, makerA, makerB] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  const t = await db.from('tutorials').insert({ title: `Ask ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()
  if (t.error) throw t.error
  tutorialId = t.data.id
  const tx = await db
    .from('toy_transactions')
    .insert({ type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown' })
    .select('id')
    .single()
  if (tx.error) throw tx.error
  txId = tx.data.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('notifications').delete().eq('toy_transaction_id', txId)
  await db.from('toy_transactions').delete().eq('id', txId)
  await db.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, makerA, makerB].map((u) => deleteTestUser(u.id)))
})

describe('111 build request questions', () => {
  it('lets a maker ask, tells the family, and the family answer in that thread', async () => {
    expect((await ask(makerA, { body: 'Which switch do you have?' })).status).toBe(201)
    const { data: told } = await adminClient().from('notifications').select('type').eq('recipient_id', family.id).eq('toy_transaction_id', txId)
    expect(told).toEqual([{ type: 'build_question' }])
    expect((await ask(family, { body: 'A 100 mm button.', maker_id: makerA.id })).status).toBe(201)
    const { data: back } = await adminClient()
      .from('notifications')
      .select('type, actor_name')
      .eq('recipient_id', makerA.id)
      .eq('toy_transaction_id', txId)
    // The family stays "Family in Newtown" to a maker until a claim.
    expect(back).toEqual([{ type: 'build_question', actor_name: 'Family in Newtown' }])
  })

  it('shows the family every thread and a maker only their own', async () => {
    expect((await ask(makerB, { body: 'Do you have the toy?' })).status).toBe(201)
    const forFamily = (await (await read(family)).json()) as Q
    expect(forFamily.family).toBe(true)
    expect(forFamily.threads.map((t) => t.maker_id).sort()).toEqual([makerA.id, makerB.id].sort())
    const forB = (await (await read(makerB)).json()) as Q
    expect(forB.threads.map((t) => t.maker_id)).toEqual([makerB.id])
    expect(JSON.stringify(forB)).not.toContain('Which switch do you have?')
  })

  it('keeps maker B out of maker A’s rows at the database too', async () => {
    const { data, error } = await direct(makerB).from('build_request_questions').select('body').eq('transaction_id', txId)
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.body)).toEqual(['Do you have the toy?'])
    const forged = await direct(makerB)
      .from('build_request_questions')
      .insert({ transaction_id: txId, maker_id: makerA.id, sender_id: makerB.id, body: 'Forged' })
    expect(forged.error).not.toBeNull()
    const { data: anon } = await createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
      .from('build_request_questions')
      .select('body')
    expect(anon ?? []).toEqual([])
  })

  it('keeps a maker in their own thread whatever maker_id they send', async () => {
    await ask(makerB, { body: 'Sneaky', maker_id: makerA.id })
    const forA = (await (await read(makerA)).json()) as Q
    expect(JSON.stringify(forA)).not.toContain('Sneaky')
  })

  it('refuses the family answering a maker who never asked, and an empty or long question', async () => {
    const stranger = await ask(family, { body: 'Hello?', maker_id: family.id })
    expect(stranger.status).toBe(404)
    for (const body of ['  ', 'x'.repeat(1001)]) expect((await ask(makerA, { body })).status).toBe(400)
  })

  it('stops at the claim, and moves the claimer’s questions into the build thread', async () => {
    expect((await app.request(`/api/toy-transactions/${txId}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${makerA.token}` } })).status).toBe(200)
    expect((await ask(makerB, { body: 'Too late?' })).status).toBe(409)
    const { data: msgs } = await adminClient().from('toy_transaction_messages').select('body, kind').eq('transaction_id', txId).order('created_at')
    const bodies = (msgs ?? []).map((m) => m.body)
    expect(bodies).toEqual(expect.arrayContaining(['Which switch do you have?', 'A 100 mm button.']))
    expect(bodies).not.toContain('Do you have the toy?')
    expect(bodies.indexOf('A 100 mm button.')).toBeLessThan(bodies.findIndex((b) => b.endsWith('claimed this build.')))
  })

  it('still lets the losing maker read their own thread, and nobody else in', async () => {
    expect((await read(makerB)).status).toBe(200)
    const outsider = await createTestUser('contributor')
    expect((await read(outsider)).status).toBe(404)
    await deleteTestUser(outsider.id)
  })
})
