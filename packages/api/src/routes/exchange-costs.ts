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
      .select('id, transaction_id, description, amount_cents, claiming, payer_id, payee_id, settled_at, settled_by, created_at')
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

export default exchangeCosts
