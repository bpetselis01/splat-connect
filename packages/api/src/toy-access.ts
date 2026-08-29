import type { createAdminClient } from './supabase/client.js'

type Client = ReturnType<typeof createAdminClient>

/** The orgs this caller leads, for scoping every org-toy read and write. An
 *  org transaction has no owner_id to compare against — see isOwnerSide in
 *  @splat-connect/types. Works through either client; RLS lets a leader read
 *  their own org_leaders rows. */
export async function ledOrgIds(client: Client, userId: string): Promise<string[]> {
  const { data } = await client.from('org_leaders').select('org_id').eq('user_id', userId)
  return (data ?? []).map((row: { org_id: string }) => row.org_id)
}

/**
 * "Mine, or my organisation's" as a PostgREST filter.
 *
 * The :id handlers scope by ownership themselves as defence in depth on top of
 * RLS, which is why they answer 404 and never 403 for someone else's row. That
 * property is preserved here — a leader gets the same 404 for another org's toy
 * that a stranger gets.
 */
export function ownedByCaller(userId: string, orgIds: string[]): string {
  const clauses = [`owner_id.eq.${userId}`]
  if (orgIds.length) clauses.push(`owner_org_id.in.(${orgIds.join(',')})`)
  return clauses.join(',')
}

/**
 * The toys with nothing left to promise. Rival requests stay 'requested' while
 * a handoff runs — they are rejected when the stock runs out, not on accept —
 * so this is what tells the giving side (and the accept guard, and a browsing
 * parent) that there is nothing left.
 *
 * This replaced "does this toy have any accepted handoff", which was the same
 * question only while one row meant one object. An organisation holding five
 * bears can run five handoffs at once; a person is the quantity=1 case and
 * behaves exactly as before. Quantity 0 is at capacity by definition.
 *
 * `toyIds` scopes the scan; null means every published, unarchived toy.
 * `hideOffered` also hides the toy someone put up in an exchange — one
 * person's single object, promised to someone, where quantity has no bearing.
 *
 * Advisory only. It is read before a write it does not hold a lock across, so
 * it may be stale by the time the caller acts — the authoritative check is the
 * one inside accept_toy_transaction(), under a row lock. This exists to render
 * a badge and to fail early, never to be the thing that stops an oversell.
 *
 * Returns null if either scan failed, so a caller can tell "nothing is full"
 * apart from "we do not know".
 */
export async function atCapacityToyIds(
  admin: Client,
  toyIds: string[] | null,
  hideOffered = false
): Promise<Set<string> | null> {
  if (toyIds?.length === 0) return new Set()
  const accepted = admin
    .from('toy_transactions')
    .select('toy_id, offered_toy_id')
    .eq('status', 'accepted')
  const stock = admin.from('toys').select('id, quantity')
  const [{ data: acceptedRows, error }, { data: toys, error: toysError }] = await Promise.all([
    toyIds ? accepted.in('toy_id', toyIds) : accepted,
    toyIds ? stock.in('id', toyIds) : stock.eq('status', 'published').is('archived_at', null),
  ])
  if (error || toysError) return null

  const takenPerToy = new Map<string, number>()
  const full = new Set<string>()
  for (const row of acceptedRows ?? []) {
    takenPerToy.set(row.toy_id, (takenPerToy.get(row.toy_id) ?? 0) + 1)
    if (hideOffered && row.offered_toy_id) full.add(row.offered_toy_id)
  }
  for (const toy of (toys ?? []) as Array<{ id: string; quantity: number }>) {
    if ((takenPerToy.get(toy.id) ?? 0) >= toy.quantity) full.add(toy.id)
  }
  return full
}
