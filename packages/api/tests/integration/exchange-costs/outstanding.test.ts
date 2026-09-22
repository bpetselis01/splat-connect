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

describe('the cost panel', () => {
  /*
   * Why: /outstanding is registered before /:transactionId, and a param route
   * that swallowed it would turn the dashboard's money panel into a lookup for
   * an exchange with the id "outstanding" — a 200 with nothing in it, which is
   * indistinguishable from owing nothing.
   */
  it('does not let the param route swallow /outstanding', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', authed(payer.token))
    const body = (await res.json()) as { exchange_count?: number; lines: unknown[] }
    expect(body.exchange_count).toBe(1)
  })

  it('returns every line on the exchange, covered ones included', async () => {
    const admin = adminClient()
    await admin.from('exchange_costs').insert({
      transaction_id: transactionId,
      description: 'Box and bubble wrap',
      amount_cents: 0,
      claiming: false,
      payer_id: payer.id,
      payee_id: payee.id,
      created_by: payee.id,
    })

    const res = await app.request(`/api/exchange-costs/${transactionId}`, authed(payer.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      lines: Array<{ description: string; claiming: boolean }>
      total_cents: number
      outstanding_cents: number
    }
    // Four: two unsettled, one settled, and the covered one just added.
    expect(body.lines).toHaveLength(4)
    expect(body.lines.some((l) => !l.claiming)).toBe(true)
    // A covered line is owed by nobody, so it is not in either figure. The
    // settled 1200 is in the total but not outstanding.
    expect(body.total_cents).toBe(2760)
    expect(body.outstanding_cents).toBe(1560)

    await admin.from('exchange_costs').delete().eq('description', 'Box and bubble wrap')
  })

  it('shows an outsider nothing, because RLS never returns the rows', async () => {
    const res = await app.request(`/api/exchange-costs/${transactionId}`, authed(outsider.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { lines: unknown[]; total_cents: number }
    expect(body.lines).toHaveLength(0)
    expect(body.total_cents).toBe(0)
  })

  /*
   * Why: either party may settle, because either may be the one who was paid
   * and so the one who knows. The payee settling their own claim is the case
   * that would break if this had been gated on payer_id.
   */
  it('lets either party settle a line, and records who did', async () => {
    const res = await app.request(`/api/exchange-costs/${transactionId}`, authed(payer.token))
    const { lines } = (await res.json()) as { lines: Array<{ id: string; settled_at: string | null }> }
    const open = lines.find((l) => !l.settled_at)!

    const settle = await app.request(`/api/exchange-costs/${open.id}/settle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${payee.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: true }),
    })
    expect(settle.status).toBe(200)
    const body = (await settle.json()) as { settled_at: string; settled_by: string }
    expect(body.settled_at).not.toBeNull()
    // The caller, never a field the client supplied.
    expect(body.settled_by).toBe(payee.id)

    // Put it back so the earlier assertions keep their arithmetic.
    await app.request(`/api/exchange-costs/${open.id}/settle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${payee.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: false }),
    })
  })

  /*
   * Why: RLS returns no row rather than refusing the update, so the route has
   * to read an absent row AS the refusal. Without that it would answer 200 and
   * the caller would believe they had settled somebody else's money.
   */
  it('refuses an outsider settling a line they cannot see', async () => {
    const res = await app.request(`/api/exchange-costs/${transactionId}`, authed(payer.token))
    const { lines } = (await res.json()) as { lines: Array<{ id: string }> }

    const settle = await app.request(`/api/exchange-costs/${lines[0].id}/settle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${outsider.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: true }),
    })
    expect(settle.status).toBe(404)
  })
})
