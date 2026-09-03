import { chunk } from '../chunk.js'
import { Hono, type Context } from 'hono'
import { randomInt } from 'node:crypto'
import { needsAction, isOwnerSide } from '@splat-connect/types'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { ledOrgIds, atCapacityToyIds } from '../toy-access.js'
import { profileName } from '../profile-name.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyTransactions = new Hono<{ Variables: AuthVariables }>()

const RLS_VIOLATION = '42501'

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// Each party proves the handoff happened by reciting the OTHER party's code
// back to them in person, so a party's own response must never carry the
// counterparty's code — otherwise the control is self-servable.
function sanitizeCodes<T extends Record<string, any>>(
  row: T,
  userId: string,
  ledOrgs: readonly string[] = []
): T {
  const isOwner = isOwnerSide(row as any, userId, ledOrgs)
  return {
    ...row,
    owner_code: isOwner ? row.owner_code : null,
    requester_code: isOwner ? null : row.requester_code,
  }
}

const PICKUP_FIELDS = ['pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode'] as const

// The owner chooses the pickup address as they accept, so it arrives on the
// request rather than being copied from their profile behind their back.
// Every field is required: a half-filled address is not a place to meet.
function readPickupAddress(body: unknown): Record<string, string> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const address: Record<string, string> = {}
  for (const field of PICKUP_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) return null
    address[field] = value.trim()
  }
  return address
}

// The name the giving side acts under. A family dealt with Cerebral Palsy
// Alliance, not with whichever leader happened to press the button, so their
// notifications say so.
async function ownerSideName(
  admin: ReturnType<typeof createAdminClient>,
  tx: { owner_id: string | null; owner_org_id: string | null },
  fallback: string
): Promise<string> {
  if (!tx.owner_org_id) return profileName(admin, tx.owner_id!, fallback)
  const { data } = await admin
    .from('organizations')
    .select('name')
    .eq('id', tx.owner_org_id)
    .maybeSingle()
  return data?.name ?? fallback
}

// One notification per person on the giving side: the owner, or every leader of
// the owning organisation. Fanning out reuses the whole existing inbox rather
// than adding org-addressed notifications, at the cost of leaving the other
// leaders an unread row once one of them acts. Deliberate — see the spec.
async function notifyOwnerSide(
  admin: ReturnType<typeof createAdminClient>,
  tx: { owner_id: string | null; owner_org_id: string | null },
  payload: Record<string, unknown>
) {
  const recipients = tx.owner_org_id
    ? (
        await admin.from('org_leaders').select('user_id').eq('org_id', tx.owner_org_id)
      ).data?.map((row: { user_id: string }) => row.user_id) ?? []
    : tx.owner_id
      ? [tx.owner_id]
      : []
  if (recipients.length === 0) return
  await admin
    .from('notifications')
    .insert(recipients.map((recipient_id) => ({ ...payload, recipient_id })))
}

type MessagePreview = { body: string; sender_id: string; kind: string; created_at: string }

// Newest message per transaction, for the list preview. PostgREST has no clean
// "latest per group", so this reads the caller's messages in order and keeps the
// last of each — RLS already limits the rows to threads they are part of.
async function lastMessages(
  supabase: ReturnType<typeof createUserClient>,
  transactionIds: string[]
): Promise<Map<string, MessagePreview>> {
  const previews = new Map<string, MessagePreview>()
  if (transactionIds.length === 0) return previews
  // Chunked: the caller passes every transaction the user can see. A
  // transaction's messages all arrive in its own chunk's (ascending) result,
  // so last-write-wins per id still lands on the latest message.
  const results = await Promise.all(
    chunk(transactionIds).map((ids) =>
      supabase
        .from('toy_transaction_messages')
        .select('transaction_id, body, sender_id, kind, created_at')
        .in('transaction_id', ids)
        .order('created_at', { ascending: true })
    )
  )
  for (const row of results.flatMap((r) => r.data ?? [])) {
    const { transaction_id, ...preview } = row as MessagePreview & { transaction_id: string }
    previews.set(transaction_id, preview)
  }
  return previews
}

type LoadResult =
  | { data: Record<string, any> }
  | { status: 404 }
  | { status: 500; message: string }

export async function loadForParty(c: Context<{ Variables: AuthVariables }>): Promise<LoadResult> {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select('*')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return { status: 404 }
    return { status: 500, message: error.message }
  }
  if (!data) return { status: 404 }
  return { data }
}

toyTransactions.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name, cover_photo_url), offered:toys!toy_transactions_offered_toy_id_fkey(name, cover_photo_url), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name), org:organizations!toy_transactions_owner_org_id_fkey(name)'
    )
    .order('updated_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      id: string
      toy_id: string
      status: string
      owner_id: string | null
      owner_org_id: string | null
      toy: { name: string; cover_photo_url: string | null } | null
      offered: { name: string; cover_photo_url: string | null } | null
      owner: { name: string } | null
      requester: { name: string } | null
      org: { name: string } | null
    }
  >
  // Advisory, and fail-open by design: a failed scan must not blank the list.
  const blockedToyIds =
    (await atCapacityToyIds(
      admin,
      rows.filter((r) => r.status === 'requested').map((r) => r.toy_id)
    )) ?? new Set<string>()
  const previews = await lastMessages(
    supabase,
    rows.map((r) => r.id)
  )
  return c.json(
    rows.map((r) => ({
      ...sanitizeCodes(r, userId, ledOrgs),
      toy_name: r.toy?.name ?? '',
      // Both embeds survive a completed handoff for either party: 025's
      // "Transaction parties can view each other's toy" policy has no end date,
      // which is what lets a giver still see the toy they handed over.
      toy_cover_photo_url: r.toy?.cover_photo_url ?? null,
      offered_toy_name: r.offered?.name ?? null,
      offered_toy_cover_photo_url: r.offered?.cover_photo_url ?? null,
      // A leader sees the family's name; a family sees the organisation's, not
      // the name of whichever leader happens to be on shift.
      other_party_name: isOwnerSide(r, userId, ledOrgs)
        ? r.requester?.name ?? ''
        : r.org?.name ?? r.owner?.name ?? '',
      // Which side of the handoff the caller is on. A leader's own toys and
      // their org's arrive in one list, and nothing else distinguishes them.
      acting_for_org_name: isOwnerSide(r, userId, ledOrgs) ? r.org?.name ?? null : null,
      blocked_by_rival_accept: r.status === 'requested' && blockedToyIds.has(r.toy_id),
      last_message: previews.get(r.id) ?? null,
    }))
  )
})

// Counts what the caller is blocking, for the Exchanges badge in the rail. The
// same predicate marks the cards themselves, so the number always matches the
// rows a user finds when they follow it.
toyTransactions.get('/action-count', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      'id, toy_id, status, type, owner_id, owner_org_id, owner_confirmed_at, requester_confirmed_at'
    )
    .in('status', ['requested', 'accepted'])
  if (error) return c.json({ error: error.message }, 500)

  const rows = (data ?? []) as Array<Parameters<typeof needsAction>[0] & { toy_id: string; status: string }>
  const admin = createAdminClient()
  const userId = c.get('userId')
  const ledOrgs = await ledOrgIds(admin, userId)
  // Advisory, and fail-open by design: a failed scan must not blank the list.
  const blockedToyIds =
    (await atCapacityToyIds(
      admin,
      rows.filter((r) => r.status === 'requested').map((r) => r.toy_id)
    )) ?? new Set<string>()
  const count = rows.filter((r) =>
    needsAction({ ...r, blocked_by_rival_accept: blockedToyIds.has(r.toy_id) }, userId, ledOrgs)
  ).length
  return c.json({ count })
})

toyTransactions.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name, status), offered:toys!toy_transactions_offered_toy_id_fkey(name, status), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name), org:organizations!toy_transactions_owner_org_id_fkey(name)'
    )
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)

  const { data: messages, error: msgError } = await supabase
    .from('toy_transaction_messages')
    .select('*')
    .eq('transaction_id', c.req.param('id'))
    .order('created_at', { ascending: true })
  if (msgError) return c.json({ error: msgError.message }, 500)

  const userId = c.get('userId')
  const row = data as unknown as Record<string, any> & {
    toy: { name: string; status: 'draft' | 'published' } | null
    offered: { name: string; status: 'draft' | 'published' } | null
    owner: { name: string } | null
    requester: { name: string } | null
    org: { name: string } | null
  }
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const blockedToyIds =
    row.status === 'requested' ? (await atCapacityToyIds(admin, [row.toy_id])) ?? new Set<string>() : new Set<string>()
  // Who received what is decided here rather than in the client, for the same
  // reason the codes are: the answer depends on who is asking. The requester
  // takes the requested toy; on an exchange the owner takes the offered one.
  // Only once the handoff is complete — before that nobody has received
  // anything, whatever the transaction is going to say later.
  //
  // On an org exchange the toy coming back is owned by the org, not by the
  // leader who ran the handoff, so `received_toy` stays null for them: the "want
  // to list this?" prompt belongs on the org's inventory screen, not in a
  // leader's personal thread sidebar.
  const received =
    row.status !== 'completed'
      ? null
      : userId === row.requester_id && row.toy
        ? { id: row.toy_id, name: row.toy.name, status: row.toy.status }
        : userId === row.owner_id && row.offered_toy_id && row.offered
          ? { id: row.offered_toy_id, name: row.offered.name, status: row.offered.status }
          : null

  return c.json({
    ...sanitizeCodes(row, userId, ledOrgs),
    toy_name: row.toy?.name ?? '',
    offered_toy_name: row.offered?.name ?? null,
    // The organisation's name where there is one: a family is dealing with
    // Cerebral Palsy Alliance, not with whichever leader is on shift.
    owner_name: row.org?.name ?? row.owner?.name ?? '',
    requester_name: row.requester?.name ?? '',
    acting_for_org_name: isOwnerSide(row as any, userId, ledOrgs) ? row.org?.name ?? null : null,
    blocked_by_rival_accept: blockedToyIds.has(row.toy_id),
    received_toy: received,
    messages: messages ?? [],
  })
})

toyTransactions.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const userId = c.get('userId')
  const admin = createAdminClient()

  const { data: toy, error: toyError } = await admin
    .from('toys')
    .select('id, owner_id, owner_org_id, quantity, offer_type, status')
    .eq('id', body.toy_id)
    .maybeSingle()
  if (toyError) {
    if (toyError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: toyError.message }, 500)
  }
  if (!toy || toy.status !== 'published') return c.json({ error: 'Not found' }, 404)
  if (toy.owner_id === userId) return c.json({ error: 'You cannot request your own toy' }, 400)
  // A leader asking their own organisation for stock would be approving their
  // own request — the org side of "you cannot request your own toy".
  if (toy.owner_org_id && (await ledOrgIds(admin, userId)).includes(toy.owner_org_id)) {
    return c.json({ error: "You cannot request your own organisation's toy" }, 400)
  }

  // Every unit already spoken for. A toy mid-handoff stays 'published', so
  // the status check above doesn't catch it. Hide it the same
  // way an inaccessible toy is hidden elsewhere: a bare 404, not a 409, so a
  // prober can't distinguish "already spoken for" from "doesn't exist."
  //
  // An org with five bears and one handoff running is NOT at capacity, which is
  // the whole difference from the check this replaced.
  const atCapacity = (await atCapacityToyIds(admin, [toy.id])) ?? new Set<string>()
  if (atCapacity.has(toy.id)) return c.json({ error: 'Not found' }, 404)

  const type = body.type as 'donation' | 'exchange'
  if (type !== 'donation' && type !== 'exchange') return c.json({ error: 'Invalid type' }, 400)
  const allowed = type === 'donation' ? ['donation', 'both'] : ['exchange', 'both']
  if (!toy.offer_type || !allowed.includes(toy.offer_type)) {
    return c.json({ error: 'This toy is not offered for that request type' }, 400)
  }

  let offeredToyId: string | null = null
  if (type === 'exchange') {
    if (!body.offered_toy_id) return c.json({ error: 'Choose one of your toys to offer' }, 400)
    const { data: offered, error: offeredError } = await admin
      .from('toys')
      .select('id, owner_id, status')
      .eq('id', body.offered_toy_id)
      .maybeSingle()
    if (offeredError) return c.json({ error: offeredError.message }, 500)
    if (!offered || offered.owner_id !== userId || offered.status !== 'published') {
      return c.json({ error: 'Choose one of your own, active toys to offer' }, 400)
    }

    const { data: offeredInUse, error: offeredInUseError } = await admin
      .from('toy_transactions')
      .select('id')
      .eq('offered_toy_id', offered.id)
      .in('status', ['requested', 'accepted'])
      .maybeSingle()
    if (offeredInUseError) return c.json({ error: offeredInUseError.message }, 500)
    if (offeredInUse) return c.json({ error: 'That toy is already offered in another open exchange' }, 409)

    offeredToyId = offered.id
  }

  const { data: existing, error: existingError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('toy_id', toy.id)
    .eq('requester_id', userId)
    .in('status', ['requested', 'accepted'])
    .maybeSingle()
  if (existingError) return c.json({ error: existingError.message }, 500)
  if (existing) return c.json({ error: 'You already have an open request for this toy' }, 409)

  const { data: tx, error: insertError } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: toy.id,
      offered_toy_id: offeredToyId,
      type,
      status: 'requested',
      requester_id: userId,
      // Mirrors the toy's own XOR. The giving side of the transaction is
      // whoever owns the toy, decided once here rather than re-derived on
      // every later read.
      owner_id: toy.owner_id,
      owner_org_id: toy.owner_org_id,
    })
    .select()
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)

  const { data: requesterProfile } = await admin.from('profiles').select('name').eq('id', userId).single()
  const { data: toyRow } = await admin.from('toys').select('name').eq('id', toy.id).single()

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: type === 'donation' ? 'Requested this toy for donation.' : 'Requested an exchange for this toy.',
  })

  await notifyOwnerSide(admin, tx, {
    type: 'toy_request',
    toy_transaction_id: tx.id,
    toy_name: toyRow?.name ?? 'a toy',
    actor_name: requesterProfile?.name ?? 'A contributor',
  })

  return c.json(tx, 201)
})

toyTransactions.post('/:id/messages', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return c.json({ error: 'Message body is required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transaction_messages')
    .insert({
      transaction_id: c.req.param('id'),
      sender_id: c.get('userId'),
      kind: 'user',
      body: body.body,
    })
    .select()
    .single()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION || error.code === RLS_VIOLATION) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json({ error: error.message }, 500)
  }

  const admin = createAdminClient()
  const { data: tx } = await admin
    .from('toy_transactions')
    .select('owner_id, owner_org_id, requester_id, toy_id')
    .eq('id', c.req.param('id'))
    .single()
  if (tx) {
    const userId = c.get('userId')
    const ledOrgs = await ledOrgIds(admin, userId)
    const { data: sender } = await admin.from('profiles').select('name').eq('id', userId).single()
    const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
    const payload = {
      type: 'toy_message',
      toy_transaction_id: c.req.param('id'),
      toy_name: toy?.name ?? 'a toy',
      actor_name: sender?.name ?? 'A contributor',
    }
    // A leader posting notifies the family; the family posting notifies every
    // leader, so whoever picks the thread up next has it in their inbox.
    if (isOwnerSide(tx, userId, ledOrgs)) {
      await admin.from('notifications').insert({ ...payload, recipient_id: tx.requester_id })
    } else {
      await notifyOwnerSide(admin, tx, payload)
    }
  }

  return c.json(data, 201)
})

toyTransactions.post('/:id/accept', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  if (!isOwnerSide(tx as any, userId, ledOrgs)) {
    return c.json({ error: 'Only the owner may accept' }, 403)
  }
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  // An organisation's pickup point is fixed, so the body is ignored entirely
  // and accept_toy_transaction() reads the org's own columns. The rule is
  // enforced at the same place that takes the unit, so neither can be bypassed
  // without the other.
  const body = await c.req.json().catch(() => null)
  const pickup = tx.owner_org_id ? null : readPickupAddress(body)
  if (!tx.owner_org_id && !pickup) {
    return c.json({ error: 'Pickup address is required to accept' }, 400)
  }

  // The atomic take. Two leaders pressing Accept in the same moment would both
  // pass a read-then-write capacity check and commit a sixth bear the org does
  // not have; this holds a row lock across the count and the write. See 033.
  const { data: result, error } = await admin.rpc('accept_toy_transaction', {
    p_transaction_id: tx.id,
    p_owner_code: generateCode(),
    p_requester_code: generateCode(),
    p_pickup_line1: pickup?.pickup_line1 ?? null,
    p_pickup_suburb: pickup?.pickup_suburb ?? null,
    p_pickup_state: pickup?.pickup_state ?? null,
    p_pickup_postcode: pickup?.pickup_postcode ?? null,
  })
  if (error) return c.json({ error: error.message }, 500)

  const outcome = (result as { outcome: string }).outcome
  if (outcome === 'missing') return c.json({ error: 'Not found' }, 404)
  if (outcome === 'closed') return c.json({ error: 'This request is no longer open' }, 409)
  if (outcome === 'no_org_pickup') {
    return c.json(
      { error: 'Your organisation needs a pickup address before you can accept requests' },
      400
    )
  }
  if (outcome === 'full') {
    return c.json(
      { error: 'Another request for this toy is already accepted. Complete or withdraw from it first.' },
      409
    )
  }
  const updated = (result as { transaction: Record<string, any> }).transaction

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    // Not "below": the web thread moved pickup and handoff into a side panel,
    // and mobile has its own layout again, so the copy no longer points at a
    // direction any client can guarantee.
    body: 'Request accepted. Pickup and handoff details are ready.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_accepted',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: await ownerSideName(admin, tx as any, 'The owner'),
  })

  // Rival requests are deliberately left open here. An accepted handoff can
  // still fall through — if it is withdrawn, the giving side should be able to
  // turn to the next requester rather than having to ask them to request again.
  // They are closed out in the confirm handler, once the stock is really gone.
  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

toyTransactions.post('/:id/reject', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  if (!isOwnerSide(tx as any, userId, ledOrgs)) {
    return c.json({ error: 'Only the owner may reject' }, 403)
  }
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ status: 'rejected', updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request declined.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_rejected',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: await ownerSideName(admin, tx as any, 'The owner'),
  })

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

toyTransactions.post('/:id/withdraw', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const fromOwnerSide = isOwnerSide(tx as any, userId, ledOrgs)
  if (!fromOwnerSide && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'requested' && tx.status !== 'accepted') {
    return c.json({ error: 'This request is no longer open' }, 409)
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ status: 'withdrawn', updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request withdrawn.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  const { data: actor } = await admin.from('profiles').select('name').eq('id', userId).single()
  const payload = {
    type: 'toy_withdrawn',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: fromOwnerSide
      ? await ownerSideName(admin, tx as any, 'The other party')
      : actor?.name ?? 'The other party',
  }
  if (fromOwnerSide) {
    await admin.from('notifications').insert({ ...payload, recipient_id: tx.requester_id })
  } else {
    await notifyOwnerSide(admin, tx as any, payload)
  }

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

toyTransactions.post('/:id/confirm', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const isOwner = isOwnerSide(tx as any, userId, ledOrgs)
  if (!isOwner && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'accepted') return c.json({ error: 'This request is not ready to confirm' }, 409)

  const canConfirm = tx.type === 'exchange' || isOwner
  if (!canConfirm) return c.json({ error: 'Only the owner confirms a donation' }, 403)

  const expectedCode = isOwner ? tx.requester_code : tx.owner_code
  if (body.code !== expectedCode) return c.json({ error: 'Incorrect code' }, 400)

  const confirmField = isOwner ? 'owner_confirmed_at' : 'requester_confirmed_at'
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ [confirmField]: now, updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  const bothConfirmed =
    tx.type === 'donation'
      ? updated.owner_confirmed_at !== null
      : updated.owner_confirmed_at !== null && updated.requester_confirmed_at !== null

  if (!bothConfirmed) {
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      kind: 'system',
      body: 'Handoff confirmed by one party. Waiting on the other.',
    })
    return c.json(sanitizeCodes(updated, userId, ledOrgs))
  }

  // The toy has changed hands, so the row says so. This replaced archiving
  // both toys, which gave the toy to nobody: two people met, swapped, and the
  // record of both objects went dark.
  //
  // 'draft' is the load-bearing half. It pulls the toy out of the public
  // library the moment it moves, because the receiver has not agreed to list
  // it — leaving it published would re-offer a toy its new owner just carried
  // home. (archived_at, 025's earlier answer to the same problem, is gone —
  // migration 050.)
  //
  // The giver needs no update: My Toys filters on owner_id, so their list
  // clears itself.
  //
  // Photos need no work either. 022's storage policies resolve the path's toy
  // id against toys.owner_id rather than against the uploader, so the new
  // owner gains upload/update/delete here and the old one loses it.
  //
  // Transfer before flipping status, for the reason archiving used to go here:
  // a failed write leaves the transaction retriable at 'accepted' rather than
  // stuck 'completed' with a toy that never moved and a guard that can never
  // let it back in.
  async function transferToy(toyId: string, to: { owner_id: string | null; owner_org_id: string | null }) {
    return admin
      .from('toys')
      .update({ ...to, status: 'draft', updated_at: now })
      .eq('id', toyId)
  }

  // An organisation gives ONE OF its units, so its row cannot move — it is the
  // stock of everything still on the shelf. The unit is minted instead: quantity
  // down by one here, a new single-unit row for the receiver there.
  //
  // The clone points at the SAME photo urls rather than copying the storage
  // objects. The bucket is public so they render, and a receiver who wants a
  // different picture uploads one into their own toy's folder, which 022 already
  // permits. This rests on one fact that is invisible from here: deleting a toy
  // does not delete its photos (routes/toys.ts deletes the row only). If storage
  // cleanup is ever added, these urls dangle and the fix is to copy the objects
  // at this point.
  // ponytail: shared photo urls, copy the objects if toy deletion ever cleans storage
  async function handOutOneUnit(toyId: string, toOwnerId: string): Promise<string | null> {
    const { data: source, error: readError } = await admin
      .from('toys')
      .select('name, description, condition, switch_adapted, photo_urls, switch_photo_url, offer_type, quantity')
      .eq('id', toyId)
      .single()
    if (readError) return readError.message

    const { error: cloneError } = await admin.from('toys').insert({
      name: source.name,
      description: source.description,
      condition: source.condition,
      switch_adapted: source.switch_adapted,
      // cover_photo_url is generated from photo_urls[1] since 053 — naming it
      // in an insert is rejected outright, so the array carries it across.
      photo_urls: source.photo_urls,
      switch_photo_url: source.switch_photo_url,
      offer_type: source.offer_type,
      owner_id: toOwnerId,
      quantity: 1,
      status: 'draft',
    })
    if (cloneError) return cloneError.message

    // Guarded on the value just read: if anything else moved the stock in
    // between, this affects no row and the caller retries at 'accepted' rather
    // than silently double-spending a unit.
    const { data: decremented, error: stockError } = await admin
      .from('toys')
      .update({ quantity: source.quantity - 1, updated_at: now })
      .eq('id', toyId)
      .eq('quantity', source.quantity)
      .select('id')
      .maybeSingle()
    if (stockError) return stockError.message
    if (!decremented) return 'Stock changed while completing this handoff'
    return null
  }

  // How much the giving side can still supply after this handoff. A person has
  // handed over the object itself, so nothing — which is what makes the rival
  // sweep below correct for both cases from one number.
  let stockRemaining = 0

  if (tx.owner_org_id) {
    const { data: stock } = await admin.from('toys').select('quantity').eq('id', tx.toy_id).single()
    const failure = await handOutOneUnit(tx.toy_id, tx.requester_id)
    if (failure) return c.json({ error: failure }, 500)
    stockRemaining = Math.max((stock?.quantity ?? 1) - 1, 0)
  } else {
    const { error: transferError } = await transferToy(tx.toy_id, {
      owner_id: tx.requester_id,
      owner_org_id: null,
    })
    if (transferError) return c.json({ error: transferError.message }, 500)
  }

  // The exchanged toy going the other way is always a person's single object,
  // so it moves rather than being cloned — into the org's inventory as an
  // unlisted draft when an org is the receiving side, for a leader to look over
  // and publish or discard.
  if (tx.offered_toy_id) {
    const { error: offeredError } = await transferToy(
      tx.offered_toy_id,
      tx.owner_org_id
        ? { owner_id: null, owner_org_id: tx.owner_org_id }
        : { owner_id: tx.owner_id, owner_org_id: null }
    )
    if (offeredError) return c.json({ error: offeredError.message }, 500)
  }

  const { data: completedTx, error: completeError } = await admin
    .from('toy_transactions')
    .update({ status: 'completed', updated_at: now })
    .eq('id', tx.id)
    .eq('status', 'accepted')
    .select()
    .maybeSingle()
  if (completeError) return c.json({ error: completeError.message }, 500)
  if (!completedTx) return c.json(sanitizeCodes({ ...updated, status: 'completed' }, userId, ledOrgs))

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Handoff confirmed. This exchange is complete.',
  })

  // The other requesters are told only once there is genuinely nothing left for
  // them. Doing this on completion rather than on accept means a request that
  // never reached a handoff leaves them in the running; doing it on STOCK rather
  // than on any completion means an org that just gave away one of five bears
  // does not decline four families who can still have one.
  const { data: rivals } = stockRemaining > 0
    ? { data: [] as Array<{ id: string; requester_id: string }> }
    : await admin
        .from('toy_transactions')
        .select('id, requester_id')
        .eq('toy_id', tx.toy_id)
        .eq('status', 'requested')
        .neq('id', tx.id)
  if (rivals?.length) {
    const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
    const actorName = await ownerSideName(admin, tx as any, 'The owner')
    for (const rival of rivals) {
      await admin.from('toy_transactions').update({ status: 'rejected', updated_at: now }).eq('id', rival.id)
      await admin.from('toy_transaction_messages').insert({
        transaction_id: rival.id,
        // The leader who ran the handoff when an org gave: sender_id is a
        // profile and an org has none.
        sender_id: tx.owner_id ?? userId,
        kind: 'system',
        body: tx.owner_org_id
          ? 'This toy is now out of stock, so this request was automatically declined.'
          : 'This toy was handed over to another request, so this one was automatically declined.',
      })
      await admin.from('notifications').insert({
        recipient_id: rival.requester_id,
        type: 'toy_rejected',
        toy_transaction_id: rival.id,
        toy_name: toy?.name ?? 'a toy',
        actor_name: actorName,
      })
    }
  }

  return c.json(sanitizeCodes(completedTx, userId, ledOrgs))
})

export default toyTransactions
