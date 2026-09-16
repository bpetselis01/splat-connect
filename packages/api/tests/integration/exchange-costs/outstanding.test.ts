/**
 * The dashboard's money panel, and the RLS underneath it.
 *
 * 055 gates every verb on is_toy_transaction_party(), so a cost line on
 * somebody else's exchange is never returned rather than filtered out here.
 * That distinction is the point of the third test: it would still pass if the
 * route filtered by payer_id and RLS were off, so it asserts on an outsider's
 * own view, where only RLS can be doing the work.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let payer: TestUser
let payee: TestUser
let outsider: TestUser
let toyId: string
let transactionId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  payer = await createTestUser('contributor')
  payee = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()

  const { data: toy } = await admin
    .from('toys')
    .insert({
      owner_id: payee.id,
      name: 'Bubble machine',
      condition: 7,
      photo_urls: ['https://example.invalid/a.jpg'],
      offer_type: 'donation',
      status: 'published',
    })
    .select('id')
    .single()
  toyId = toy!.id

  const { data: tx } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: toyId,
      type: 'donation',
      status: 'accepted',
      requester_id: payer.id,
      owner_id: payee.id,
    })
    .select('id')
    .single()
  transactionId = tx!.id

  await admin.from('exchange_costs').insert([
    {
      transaction_id: transactionId,
      description: 'Filament for your switch mount',
      amount_cents: 500,
      payer_id: payer.id,
      payee_id: payee.id,
      created_by: payee.id,
    },
    {
      transaction_id: transactionId,
      description: 'Postage on the handover',
      amount_cents: 1060,
      payer_id: payer.id,
      payee_id: payee.id,
      created_by: payee.id,
    },
    // Already settled: history, and the panel never asks for it.
    {
      transaction_id: transactionId,
      description: 'Parts kit',
      amount_cents: 1200,
      payer_id: payer.id,
      payee_id: payee.id,
      created_by: payee.id,
      settled_at: new Date().toISOString(),
      settled_by: payee.id,
    },
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('exchange_costs').delete().eq('transaction_id', transactionId)
  await admin.from('toy_transactions').delete().eq('id', transactionId)
  await admin.from('toys').delete().eq('id', toyId)
  await Promise.all([deleteTestUser(payer.id), deleteTestUser(payee.id), deleteTestUser(outsider.id)])
})

describe('the money panel', () => {
  it('totals what the caller still owes, and leaves settled lines out', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', authed(payer.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      lines: Array<{ description: string }>
      total_cents: number
      exchange_count: number
    }
    expect(body.lines).toHaveLength(2)
    // 500 + 1060. The settled 1200 is not in it.
    expect(body.total_cents).toBe(1560)
    expect(body.lines.map((l) => l.description)).not.toContain('Parts kit')
  })

  /*
   * Why: the panel's sentence counts exchanges, not lines. Two costs on one
   * exchange is "across 1 exchange", and getting that wrong reads as the person
   * owing money to twice as many people as they do.
   */
  it('counts distinct exchanges rather than lines', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', authed(payer.token))
    const body = (await res.json()) as { exchange_count: number }
    expect(body.exchange_count).toBe(1)
  })

  /*
   * Why: only what you owe. A single figure that silently nets what you are
   * owed against what you owe is worse than either number by itself, so the
   * payee sees nothing here for lines they are collecting.
   */
  it('shows the payee nothing for money owed to them', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', authed(payee.token))
    const body = (await res.json()) as { lines: unknown[]; total_cents: number }
    expect(body.lines).toHaveLength(0)
    expect(body.total_cents).toBe(0)
  })

  /*
   * Why: this is the RLS assertion. An outsider is not a party to the exchange,
   * so 055's policy means the rows are never returned — not filtered out by the
   * route, which only ever filters on payer_id and would look identical here
   * with RLS switched off.
   */
  it('returns nothing to somebody who is not a party to the exchange', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', authed(outsider.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { lines: unknown[] }
    expect(body.lines).toHaveLength(0)
  })
})
