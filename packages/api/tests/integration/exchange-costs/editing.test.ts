/**
 * Writing to the cost panel: adding a line, removing one, and recording how the
 * money changed hands.
 *
 * Three rules are load-bearing and each has a test that fails if it is dropped:
 *
 * - **The client never names the payer.** The caller is always the payee — "I
 *   paid this" is the only honest reading of adding a cost — and the other
 *   party is looked up from the exchange. A client-supplied payer could name
 *   the wrong pair, and 055's trigger would then reject it as a 500 rather than
 *   a refusal that says why.
 * - **Only whoever added a line may remove it.** 055's delete policy is
 *   `created_by = auth.uid()`; settling is the other party's lever and deleting
 *   their record of what they are owed is not.
 * - **`note_by` and `updated_by` are the caller.** The byline under a quote is
 *   the only thing that makes the quote worth having.
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
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  payer = await createTestUser('contributor')
  payee = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()

  const { data: toy } = await admin
    .from('toys')
    .insert({
      owner_id: payee.id,
      name: 'Light-up spinner',
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
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('exchange_settlements').delete().eq('transaction_id', transactionId)
  await admin.from('exchange_costs').delete().eq('transaction_id', transactionId)
  await admin.from('toy_transactions').delete().eq('id', transactionId)
  await admin.from('toys').delete().eq('id', toyId)
  await Promise.all([
    deleteTestUser(payer.id),
    deleteTestUser(payee.id),
    deleteTestUser(outsider.id),
  ])
})

describe('adding a cost', () => {
  it('makes the caller the payee and the other party the payer', async () => {
    const res = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', { description: 'Filament', amount_cents: 1210 })
    )
    expect(res.status).toBe(201)
    const line = (await res.json()) as {
      id: string
      payer_id: string
      payee_id: string
      claiming: boolean
    }
    expect(line.payee_id).toBe(payee.id)
    expect(line.payer_id).toBe(payer.id)
    // 056's default: a cost entered without saying otherwise is one being
    // claimed back, because covering something is the deliberate act.
    expect(line.claiming).toBe(true)

    await adminClient().from('exchange_costs').delete().eq('id', line.id)
  })

  it('accepts a covered line at nothing, and refuses a claimed one at nothing', async () => {
    const covered = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', {
        description: 'Box and bubble wrap',
        amount_cents: 0,
        claiming: false,
      })
    )
    expect(covered.status).toBe(201)
    const line = (await covered.json()) as { id: string }

    const claimed = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', { description: 'Nothing at all', amount_cents: 0 })
    )
    expect(claimed.status).toBe(400)

    await adminClient().from('exchange_costs').delete().eq('id', line.id)
  })

  it('refuses an amount that is not whole cents, and an empty description', async () => {
    const fraction = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', { description: 'Postage', amount_cents: 10.5 })
    )
    expect(fraction.status).toBe(400)

    const blank = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', { description: '   ', amount_cents: 500 })
    )
    expect(blank.status).toBe(400)
  })

  /*
   * Why: RLS never returns the exchange to an outsider, so the lookup finds no
   * row. That has to read as a refusal rather than fall through to an insert
   * the trigger would then reject with a Postgres message.
   */
  it('refuses somebody who is not a party to the exchange', async () => {
    const res = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(outsider.token, 'POST', { description: 'Not mine', amount_cents: 500 })
    )
    expect(res.status).toBe(404)
  })
})

describe('removing a cost', () => {
  it('lets the author remove their own line and nobody else remove it', async () => {
    const created = await app.request(
      `/api/exchange-costs/${transactionId}`,
      json(payee.token, 'POST', { description: 'Mine to remove', amount_cents: 300 })
    )
    const line = (await created.json()) as { id: string }

    const byOther = await app.request(`/api/exchange-costs/${line.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${payer.token}` },
    })
    // The policy returns no row rather than refusing, and an absent row IS the
    // refusal — so this must be a 404 and the line must still be there.
    expect(byOther.status).toBe(404)

    const stillThere = await app.request(`/api/exchange-costs/${transactionId}`, authed(payer.token))
    const { lines } = (await stillThere.json()) as { lines: Array<{ id: string }> }
    expect(lines.map((l) => l.id)).toContain(line.id)

    const byAuthor = await app.request(`/api/exchange-costs/${line.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${payee.token}` },
    })
    expect(byAuthor.status).toBe(200)
  })
})

describe('the settlement', () => {
  it('attributes the note to the caller and upserts on a second save', async () => {
    const first = await app.request(
      `/api/exchange-costs/${transactionId}/settlement`,
      json(payee.token, 'PUT', { note: 'Happy to wait until after the handover.', method: 'Bank transfer' })
    )
    expect(first.status).toBe(200)
    const body = (await first.json()) as { note_by: string; method: string }
    expect(body.note_by).toBe(payee.id)
    expect(body.method).toBe('Bank transfer')

    // One row per exchange: saving again replaces rather than duplicating, and
    // the other party may be the one who writes it.
    const second = await app.request(
      `/api/exchange-costs/${transactionId}/settlement`,
      json(payer.token, 'PUT', { note: 'Sent it this morning.', method: 'Bank transfer' })
    )
    expect(second.status).toBe(200)
    expect(((await second.json()) as { note_by: string }).note_by).toBe(payer.id)

    const read = await app.request(`/api/exchange-costs/${transactionId}`, authed(payer.token))
    const { settlement } = (await read.json()) as { settlement: { note: string } }
    expect(settlement.note).toBe('Sent it this morning.')
  })

  it('clears the byline when the note is cleared', async () => {
    const res = await app.request(
      `/api/exchange-costs/${transactionId}/settlement`,
      json(payee.token, 'PUT', { note: '', method: 'Cash' })
    )
    expect(res.status).toBe(200)
    // 056's check constraint is note and note_by together or neither — a
    // dangling byline would fail the insert with an opaque 500.
    const body = (await res.json()) as { note: string | null; note_by: string | null }
    expect(body.note).toBeNull()
    expect(body.note_by).toBeNull()
  })

  it('refuses an outsider recording a settlement', async () => {
    const res = await app.request(
      `/api/exchange-costs/${transactionId}/settlement`,
      json(outsider.token, 'PUT', { note: 'Not mine', method: 'Cash' })
    )
    expect(res.status).toBe(404)
  })
})
