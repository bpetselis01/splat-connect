/**
 * Costs two parties agreed between themselves on an exchange.
 *
 * SPLAT never handles the money — the dashboard panel says so in as many words
 * — so there is nothing here that moves funds. These endpoints record what was
 * agreed and who said it was paid.
 *
 * Reads go through the USER client, so RLS is what decides visibility rather
 * than a filter written here: 055's policies gate every verb on
 * is_toy_transaction_party(), which already counts the owning organisation's
 * leaders. A cost line on somebody else's exchange is not filtered out, it is
 * never returned.
 *
 * Related files:
 * - supabase/migrations/055_exchange_costs.sql: the table, its policies and the
 *   trigger that enforces payer and payee are parties to THIS exchange
 * - packages/types/src/index.ts: ExchangeCost, and formatCents
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const exchangeCosts = new Hono<{ Variables: AuthVariables }>()

/**
 * The row shape this endpoint returns.
 *
 * Written out rather than inferred because the Supabase client here carries no
 * generated Database types — the same reason routes/saves.ts names its filter
 * builder structurally. Inferring an embedded select off an untyped client
 * gives back a union with PostgREST's error shape in it, and every field access
 * then fails on the error arm.
 */
type OutstandingCost = {
  id: string
  transaction_id: string
  description: string
  amount_cents: number
  payer_id: string
  payee_id: string
  created_at: string
  toy_transactions: { id: string; type: string; toys: { name: string } | null } | null
}

/**
 * GET /api/exchange-costs/outstanding
 *
 * Everything the caller has agreed to pay and not yet settled, newest first,
 * across every exchange they are party to. This is the dashboard's money panel.
 *
 * Deliberately only what the caller OWES, not what they are owed. The panel is
 * headed "Money you have agreed to" and a single figure that silently nets the
 * two directions against each other would be worse than either number alone.
 *
 * The toy's name and the counterparty come from the embedded transaction rather
 * than a second round trip; PostgREST can embed here because transaction_id is
 * a real foreign key, which is what 044's save rows could not do.
 */
exchangeCosts.get('/outstanding', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('exchange_costs')
    .select(
      'id, transaction_id, description, amount_cents, payer_id, payee_id, created_at, ' +
        // The FK is named because toy_transactions has two of them to toys —
        // toy_id and offered_toy_id, the second being the toy offered back in a
        // swap. Left ambiguous PostgREST refuses the whole query with PGRST201.
        // This is the toy being given, which is what the panel names.
        'toy_transactions(id, type, toys!toy_transactions_toy_id_fkey(name))'
    )
    .eq('payer_id', userId)
    .is('settled_at', null)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)

  const rows = (data ?? []) as unknown as OutstandingCost[]
  return c.json({
    lines: rows,
    total_cents: rows.reduce((sum, r) => sum + r.amount_cents, 0),
    // What the panel's sentence counts. Distinct exchanges, not lines: four
    // lines on one exchange is "across 1 exchange".
    exchange_count: new Set(rows.map((r) => r.transaction_id)).size,
  })
})

/**
 * GET /api/exchange-costs/:transactionId
 *
 * Every cost line on one exchange plus its settlement, for the cost panel on
 * the detail screen. RLS is the gate: a caller who is not a party to this
 * exchange gets empty arrays rather than a 403, because 055's policies mean the
 * rows are never returned in the first place.
 *
 * Both claimed and covered lines come back. A covered line is the point of the
 * flag — it says somebody absorbed a cost rather than that no cost existed —
 * so filtering it out here would lose exactly the thing it records.
 */
exchangeCosts.get('/:transactionId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const transactionId = c.req.param('transactionId')

  const [lines, settlement] = await Promise.all([
    supabase
      .from('exchange_costs')
      .select(
        'id, transaction_id, description, amount_cents, claiming, payer_id, payee_id, settled_at, settled_by, created_by, created_at'
      )
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('exchange_settlements')
      .select('transaction_id, note, note_by, receipt_path, method, updated_at, updated_by')
      .eq('transaction_id', transactionId)
      .maybeSingle(),
  ])

  if (lines.error) return c.json({ error: lines.error.message }, 500)

  const rows = (lines.data ?? []) as unknown as Array<{
    amount_cents: number
    claiming: boolean
    settled_at: string | null
  }>

  return c.json({
    lines: lines.data ?? [],
    settlement: settlement.data ?? null,
    // Only claimed lines count. A covered one is listed at its own cost and
    // owed by nobody, so adding it to a total the payer reads as "what I owe"
    // would be wrong in the direction that costs somebody money.
    total_cents: rows.filter((r) => r.claiming).reduce((sum, r) => sum + r.amount_cents, 0),
    outstanding_cents: rows
      .filter((r) => r.claiming && !r.settled_at)
      .reduce((sum, r) => sum + r.amount_cents, 0),
  })
})

/**
 * PATCH /api/exchange-costs/:id/settle
 *
 * Marks one line settled, or un-marks it. Either party may, because either may
 * be the one who was paid and so the one who knows — 055's update policy says
 * the same thing.
 *
 * `settled_by` is always the caller. It is not a field the client supplies:
 * the whole value of the column is that it records who made the claim, and a
 * client-supplied one records who the client said made it.
 */
exchangeCosts.patch('/:id/settle', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const body = (await c.req.json().catch(() => ({}))) as { settled?: boolean }
  const settled = body.settled !== false

  const { data, error } = await supabase
    .from('exchange_costs')
    .update(
      settled
        ? { settled_at: new Date().toISOString(), settled_by: userId }
        : { settled_at: null, settled_by: null }
    )
    .eq('id', c.req.param('id'))
    .select('id, settled_at, settled_by')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns no row rather than refusing, so an absent row IS the refusal.
  if (!data) return c.json({ error: 'No such cost on an exchange you are part of.' }, 404)
  return c.json(data)
})

/**
 * The party on the other side of an exchange from the caller, or a Response
 * saying why there is not one.
 *
 * A cost line names a payer and a payee and 055's trigger insists both are
 * parties to THIS exchange. The client does not get to say who they are: it
 * would be able to name the wrong pair, and the only honest reading of "add a
 * cost" is "I paid this" — so the caller is always the payee and the other
 * party the payer.
 *
 * An organisation-owned exchange has `owner_id` null (033 moved the owner to
 * `owner_org_id`), so there is no profile to put on the other side of the line.
 * That is refused here with the reason rather than left to the trigger, which
 * would surface as a 500 with a Postgres message in it.
 */
async function otherParty(
  supabase: ReturnType<typeof createUserClient>,
  transactionId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('toy_transactions')
    .select('id, requester_id, owner_id, owner_org_id, status')
    .eq('id', transactionId)
    .maybeSingle()

  if (error) return { error: error.message, status: 500 as const }
  // RLS returns no row rather than refusing, so an absent row IS the refusal.
  if (!data) return { error: 'No such exchange.', status: 404 as const }

  const tx = data as unknown as {
    requester_id: string
    owner_id: string | null
    owner_org_id: string | null
  }
  if (!tx.owner_id) {
    return {
      error:
        'Costs on an organisation-held exchange are not recorded yet — a cost line names two people and this exchange is held by an organisation.',
      status: 400 as const,
    }
  }
  if (tx.requester_id !== userId && tx.owner_id !== userId) {
    return { error: 'Only a party to the exchange can record a cost on it.', status: 403 as const }
  }
  return { payer: tx.requester_id === userId ? tx.owner_id : tx.requester_id }
}

/**
 * POST /api/exchange-costs/:transactionId
 *
 * Records one cost the caller paid on this exchange. Validated here rather than
 * left to the table's checks: these are the same bounds 055 and 056 state, and
 * a constraint violation reaches the browser as an opaque 500.
 */
exchangeCosts.post('/:transactionId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const transactionId = c.req.param('transactionId')
  const body = (await c.req.json().catch(() => ({}))) as {
    description?: unknown
    amount_cents?: unknown
    claiming?: unknown
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length < 1 || description.length > 200) {
    return c.json({ error: 'Say what the cost is for, in 200 characters or fewer.' }, 400)
  }
  const amount = body.amount_cents
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 100000000) {
    return c.json({ error: 'The amount must be a whole number of cents, up to $1,000,000.' }, 400)
  }
  const claiming = body.claiming !== false
  // 056 relaxed the positive check for covered lines only: somebody recording
  // that they absorbed the postage need not price it, but a line being claimed
  // has to be worth something.
  if (claiming && amount < 1) {
    return c.json({ error: 'A cost you are claiming back has to be more than nothing.' }, 400)
  }

  const party = await otherParty(supabase, transactionId, userId)
  if ('error' in party) return c.json({ error: party.error }, party.status)

  const { data, error } = await supabase
    .from('exchange_costs')
    .insert({
      transaction_id: transactionId,
      description,
      amount_cents: amount,
      claiming,
      payer_id: party.payer,
      payee_id: userId,
      created_by: userId,
    })
    .select(
      'id, transaction_id, description, amount_cents, claiming, payer_id, payee_id, settled_at, settled_by, created_by, created_at'
    )
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That exchange is not yours to add a cost to.' }, 403)
  return c.json(data, 201)
})

/**
 * DELETE /api/exchange-costs/:id
 *
 * Removes a line. 055's delete policy is `created_by = auth.uid()` and that is
 * the whole rule: settling is the other party's lever, deleting somebody else's
 * record of what they are owed is not.
 */
exchangeCosts.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('exchange_costs')
    .delete()
    .eq('id', c.req.param('id'))
    .select('id')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such cost line of yours.' }, 404)
  return c.json({ id: (data as { id: string }).id })
})

/**
 * PUT /api/exchange-costs/:transactionId/settlement
 *
 * The note, the method and the receipt: one row per exchange, so this upserts
 * on the primary key rather than choosing between insert and update.
 *
 * `note_by` and `updated_by` are the caller, never the client's word for it —
 * the byline under a quote is the only thing that makes the quote worth having.
 */
exchangeCosts.put('/:transactionId/settlement', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const transactionId = c.req.param('transactionId')
  const body = (await c.req.json().catch(() => ({}))) as {
    note?: unknown
    method?: unknown
    receipt_path?: unknown
  }

  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
  if (note && note.length > 1000) {
    return c.json({ error: 'The note is longer than 1000 characters.' }, 400)
  }
  const method = typeof body.method === 'string' && body.method.trim() ? body.method.trim() : null
  if (method && method.length > 60) {
    return c.json({ error: 'The method is longer than 60 characters.' }, 400)
  }
  const receiptPath =
    typeof body.receipt_path === 'string' && body.receipt_path.trim()
      ? body.receipt_path.trim()
      : null

  const party = await otherParty(supabase, transactionId, userId)
  if ('error' in party) return c.json({ error: party.error }, party.status)

  const { data, error } = await supabase
    .from('exchange_settlements')
    .upsert(
      {
        transaction_id: transactionId,
        note,
        note_by: note ? userId : null,
        method,
        receipt_path: receiptPath,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: 'transaction_id' }
    )
    .select('transaction_id, note, note_by, receipt_path, method, updated_at, updated_by')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That exchange is not yours to settle.' }, 403)
  return c.json(data)
})

/**
 * POST /api/exchange-costs/:transactionId/receipt
 *
 * Uploads a receipt into the private `exchange-receipts` bucket and returns its
 * path. The path shape is `<transaction_id>/<file>` because 056's storage
 * policies read the first folder segment as the exchange id — a file written
 * anywhere else matches no exchange and is readable by nobody.
 *
 * It returns the path rather than storing it: the settlement row is written by
 * PUT above, so an upload that succeeds and a settlement that fails leaves an
 * orphan object rather than a row pointing at a file that is not there.
 */
exchangeCosts.post('/:transactionId/receipt', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const transactionId = c.req.param('transactionId')

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'A file is required.' }, 400)

  const party = await otherParty(supabase, transactionId, userId)
  if ('error' in party) return c.json({ error: party.error }, party.status)

  const { data, error } = await supabase.storage
    .from('exchange-receipts')
    .upload(`${transactionId}/${file.name}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ receipt_path: data.path })
})

export default exchangeCosts
