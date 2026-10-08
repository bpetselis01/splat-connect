/**
 * The Me tab's money panel: every thread with money on it, whichever way it
 * runs, settled or not, named by the other person and the kind of thread.
 */
// journeys: Q01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let sam: TestUser
let tom: TestUser
let outsider: TestUser
// Two people with money both ways on one exchange.
let ana: TestUser
let ben: TestUser
let toyId: string
let guideId: string
const tx: Record<string, string> = {}

const mine = async (u: TestUser) => {
  const res = await app.request('/api/exchange-costs/mine', { headers: { Authorization: `Bearer ${u.token}` } })
  expect(res.status).toBe(200)
  return (await res.json()) as {
    threads: Array<{ transaction_id: string; type: string; other_name: string; what: string; amount_cents: number; you_pay: boolean; settled: boolean }>
    owed_cents: number
    unsettled_count: number
  }
}

beforeAll(async () => {
  sam = await createTestUser('contributor')
  tom = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  ana = await createTestUser('contributor')
  ben = await createTestUser('contributor')
  const admin = adminClient()
  toyId = (
    await admin
      .from('toys')
      .insert({ owner_id: tom.id, name: 'Bubble machine', condition: 8, photo_urls: ['https://example.com/b.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id
  guideId = (
    await admin.from('tutorials').insert({ title: 'Bubble machine build', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
  ).data!.id
  const insertTx = async (row: Record<string, unknown>) =>
    (await admin.from('toy_transactions').insert(row).select('id').single()).data!.id as string
  // Sam asked Tom for a toy; Tom paid the postage and covered the box.
  tx.donation = await insertTx({ toy_id: toyId, type: 'donation', status: 'accepted', requester_id: sam.id, owner_id: tom.id })
  // Tom asked Sam to build; Sam bought the parts and Tom has paid him back.
  tx.build = await insertTx({ type: 'build', status: 'accepted', requester_id: tom.id, owner_id: sam.id, tutorial_id: guideId, build_brief: 'A bubble machine' })
  // Only a covered line: $0 to everyone, so no row at all.
  tx.covered = await insertTx({ toy_id: toyId, type: 'donation', status: 'requested', requester_id: sam.id, owner_id: tom.id })
  // Ana paid Ben back for postage (settled); Ben still owes Ana for a part.
  tx.both = await insertTx({ toy_id: toyId, type: 'exchange', status: 'accepted', requester_id: ana.id, owner_id: ben.id })
  const line = (transaction_id: string, payer: TestUser, payee: TestUser, description: string, amount_cents: number, extra: object = {}) => ({
    transaction_id, payer_id: payer.id, payee_id: payee.id, created_by: payee.id, description, amount_cents, claiming: true, settled_at: null, settled_by: null, ...extra,
  })
  const { error } = await admin.from('exchange_costs').insert([
    line(tx.donation, sam, tom, 'Postage on the handover', 1060),
    line(tx.donation, sam, tom, 'Box', 0, { claiming: false }),
    line(tx.build, tom, sam, 'Parts for the bubble machine', 890, { settled_at: new Date().toISOString(), settled_by: sam.id }),
    line(tx.covered, sam, tom, 'Bubble wrap', 0, { claiming: false }),
    line(tx.both, ana, ben, 'Postage', 500, { settled_at: new Date().toISOString(), settled_by: ben.id }),
    line(tx.both, ben, ana, 'A spare switch', 300),
  ])
  expect(error).toBeNull()
})

afterAll(async () => {
  const admin = adminClient()
  const ids = Object.values(tx)
  await admin.from('exchange_costs').delete().in('transaction_id', ids)
  await admin.from('toy_transactions').delete().in('id', ids)
  await admin.from('toys').delete().eq('id', toyId)
  await admin.from('tutorials').delete().eq('id', guideId)
  for (const u of [sam, tom, outsider, ana, ben]) await deleteTestUser(u.id)
})

describe('GET /api/exchange-costs/mine', () => {
  it('lists money both ways, settled or not, unsettled first, and skips a thread with nothing claimed', async () => {
    const tomName = (await adminClient().from('profiles').select('name').eq('id', tom.id).single()).data!.name
    const body = await mine(sam)
    expect(body.threads.map((t) => t.transaction_id)).toEqual([tx.donation, tx.build])
    expect(body.threads[0]).toMatchObject({ type: 'donation', other_name: tomName, amount_cents: 1060, you_pay: true, settled: false })
    expect(body.threads[0].what).toContain('Postage on the handover')
    expect(body.threads[1]).toMatchObject({ type: 'build', other_name: tomName, amount_cents: 890, you_pay: false, settled: true })
    // Only what Sam still owes; what he is owed is never netted against it.
    expect(body.owed_cents).toBe(1060)
    expect(body.unsettled_count).toBe(1)
  })

  it('settles each direction on its own: paid back but still owed shows what is owed, to settle', async () => {
    const ana_ = await mine(ana)
    expect(ana_.threads).toHaveLength(1)
    expect(ana_.threads[0]).toMatchObject({ transaction_id: tx.both, amount_cents: 300, you_pay: false, settled: false })
    expect(ana_.owed_cents).toBe(0)
    expect(ana_.unsettled_count).toBe(1)
    const ben_ = await mine(ben)
    expect(ben_.threads[0]).toMatchObject({ transaction_id: tx.both, amount_cents: 300, you_pay: true, settled: false })
    expect(ben_.owed_cents).toBe(300)
    expect(ben_.unsettled_count).toBe(1)
  })

  it('shows somebody outside every thread nothing', async () => {
    expect(await mine(outsider)).toEqual({ threads: [], owed_cents: 0, unsettled_count: 0 })
  })

  it('is not swallowed by the param route, and /outstanding keeps its shape for web (it also counts the covered line)', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', { headers: { Authorization: `Bearer ${sam.token}` } })
    expect(((await res.json()) as { exchange_count: number }).exchange_count).toBe(2)
  })
})
