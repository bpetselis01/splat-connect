import { Hono, type Context } from 'hono'
import { randomInt } from 'node:crypto'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyTransactions = new Hono<{ Variables: AuthVariables }>()

export { INVALID_TEXT_REPRESENTATION }
export const RLS_VIOLATION = '42501'

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// Each party proves the handoff happened by reciting the OTHER party's code
// back to them in person, so a party's own response must never carry the
// counterparty's code — otherwise the control is self-servable.
function sanitizeCodes<T extends Record<string, any>>(row: T, userId: string): T {
  const isOwner = row.owner_id === userId
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

// A toy may only have one accepted handoff at a time. Rival requests stay
// 'requested' while it runs — they are rejected on completion, not on accept —
// so this is what tells the owner (and the accept guard) that they are locked.
async function acceptedToyIds(
  admin: ReturnType<typeof createAdminClient>,
  toyIds: string[]
): Promise<Set<string>> {
  if (toyIds.length === 0) return new Set()
  const { data } = await admin
    .from('toy_transactions')
    .select('toy_id')
    .eq('status', 'accepted')
    .in('toy_id', toyIds)
  return new Set((data ?? []).map((row: { toy_id: string }) => row.toy_id))
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
      '*, toy:toys!toy_transactions_toy_id_fkey(name), offered:toys!toy_transactions_offered_toy_id_fkey(name), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name)'
    )
    .order('updated_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const userId = c.get('userId')
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      toy_id: string
      status: string
      owner_id: string
      toy: { name: string } | null
      offered: { name: string } | null
      owner: { name: string } | null
      requester: { name: string } | null
    }
  >
  const blockedToyIds = await acceptedToyIds(
    createAdminClient(),
    rows.filter((r) => r.status === 'requested').map((r) => r.toy_id)
  )
  return c.json(
    rows.map((r) => ({
      ...sanitizeCodes(r, userId),
      toy_name: r.toy?.name ?? '',
      offered_toy_name: r.offered?.name ?? null,
      other_party_name: r.owner_id === userId ? r.requester?.name ?? '' : r.owner?.name ?? '',
      blocked_by_rival_accept: r.status === 'requested' && blockedToyIds.has(r.toy_id),
    }))
  )
})

toyTransactions.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name), offered:toys!toy_transactions_offered_toy_id_fkey(name), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name)'
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
    toy: { name: string } | null
    offered: { name: string } | null
    owner: { name: string } | null
    requester: { name: string } | null
  }
  const blockedToyIds =
    row.status === 'requested'
      ? await acceptedToyIds(createAdminClient(), [row.toy_id])
      : new Set<string>()
  return c.json({
    ...sanitizeCodes(row, userId),
    toy_name: row.toy?.name ?? '',
    offered_toy_name: row.offered?.name ?? null,
    owner_name: row.owner?.name ?? '',
    requester_name: row.requester?.name ?? '',
    blocked_by_rival_accept: blockedToyIds.has(row.toy_id),
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
    .select('id, owner_id, offer_type, status, archived_at')
    .eq('id', body.toy_id)
    .maybeSingle()
  if (toyError) {
    if (toyError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: toyError.message }, 500)
  }
  if (!toy || toy.status !== 'published' || toy.archived_at) return c.json({ error: 'Not found' }, 404)
  if (toy.owner_id === userId) return c.json({ error: 'You cannot request your own toy' }, 400)

  // A toy already mid-handoff (accepted but not yet completed) stays
  // 'published' and unarchived, so the status check above doesn't catch it.
  // Hide this the same way an inaccessible toy is hidden elsewhere: a bare
  // 404, not a 409, so a prober can't distinguish "already spoken for" from
  // "doesn't exist."
  const { data: activeHandoff, error: activeHandoffError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('toy_id', toy.id)
    .eq('status', 'accepted')
    .maybeSingle()
  if (activeHandoffError) return c.json({ error: activeHandoffError.message }, 500)
  if (activeHandoff) return c.json({ error: 'Not found' }, 404)

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
      .select('id, owner_id, status, archived_at')
      .eq('id', body.offered_toy_id)
      .maybeSingle()
    if (offeredError) return c.json({ error: offeredError.message }, 500)
    if (!offered || offered.owner_id !== userId || offered.status !== 'published' || offered.archived_at) {
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
      owner_id: toy.owner_id,
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

  await admin.from('notifications').insert({
    recipient_id: toy.owner_id,
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
    .select('owner_id, requester_id, toy_id')
    .eq('id', c.req.param('id'))
    .single()
  if (tx) {
    const userId = c.get('userId')
    const recipientId = tx.owner_id === userId ? tx.requester_id : tx.owner_id
    const { data: sender } = await admin.from('profiles').select('name').eq('id', userId).single()
    const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
    await admin.from('notifications').insert({
      recipient_id: recipientId,
      type: 'toy_message',
      toy_transaction_id: c.req.param('id'),
      toy_name: toy?.name ?? 'a toy',
      actor_name: sender?.name ?? 'A contributor',
    })
  }

  return c.json(data, 201)
})

toyTransactions.post('/:id/accept', async (c) => {
  const body = await c.req.json().catch(() => null)
  const pickup = readPickupAddress(body)
  if (!pickup) return c.json({ error: 'Pickup address is required to accept' }, 400)

  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id) return c.json({ error: 'Only the owner may accept' }, 403)
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const admin = createAdminClient()

  // Rivals are no longer rejected on accept, so nothing else stops a second
  // acceptance on the same toy. This is that stop — the server-side half of
  // the locked Accept button the owner sees.
  const { data: rivalAccepted, error: rivalAcceptedError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('toy_id', tx.toy_id)
    .eq('status', 'accepted')
    .neq('id', tx.id)
    .maybeSingle()
  if (rivalAcceptedError) return c.json({ error: rivalAcceptedError.message }, 500)
  if (rivalAccepted) {
    return c.json(
      { error: 'Another request for this toy is already accepted. Complete or withdraw from it first.' },
      409
    )
  }

  const ownerCode = generateCode()
  const requesterCode = generateCode()
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({
      status: 'accepted',
      owner_code: ownerCode,
      requester_code: requesterCode,
      ...pickup,
      updated_at: now,
    })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request accepted. Pickup details are ready below.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  const { data: ownerName } = await admin.from('profiles').select('name').eq('id', userId).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_accepted',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: ownerName?.name ?? 'The owner',
  })

  // Rival requests are deliberately left open here. An accepted handoff can
  // still fall through — if it is withdrawn, the owner should be able to turn
  // to the next requester rather than having to ask them to request again.
  // They are closed out in the confirm handler, once the toy is really gone.
  return c.json(sanitizeCodes(updated, userId))
})

toyTransactions.post('/:id/reject', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id) return c.json({ error: 'Only the owner may reject' }, 403)
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const admin = createAdminClient()
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
  const { data: ownerName } = await admin.from('profiles').select('name').eq('id', userId).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_rejected',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: ownerName?.name ?? 'The owner',
  })

  return c.json(sanitizeCodes(updated, userId))
})

toyTransactions.post('/:id/withdraw', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'requested' && tx.status !== 'accepted') {
    return c.json({ error: 'This request is no longer open' }, 409)
  }

  const admin = createAdminClient()
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
  const recipientId = userId === tx.owner_id ? tx.requester_id : tx.owner_id
  await admin.from('notifications').insert({
    recipient_id: recipientId,
    type: 'toy_withdrawn',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: actor?.name ?? 'The other party',
  })

  return c.json(sanitizeCodes(updated, userId))
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
  const isOwner = userId === tx.owner_id
  if (!isOwner && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'accepted') return c.json({ error: 'This request is not ready to confirm' }, 409)

  const canConfirm = tx.type === 'exchange' || isOwner
  if (!canConfirm) return c.json({ error: 'Only the owner confirms a donation' }, 403)

  const expectedCode = isOwner ? tx.requester_code : tx.owner_code
  if (body.code !== expectedCode) return c.json({ error: 'Incorrect code' }, 400)

  const admin = createAdminClient()
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
    return c.json(sanitizeCodes(updated, userId))
  }

  // Archive before flipping status: if an archive update fails, the
  // transaction is left retriable at 'accepted' instead of stuck
  // 'completed' with an unarchived toy the top-of-handler guard can never
  // let back in.
  const { error: archiveError } = await admin
    .from('toys')
    .update({ archived_at: now, updated_at: now })
    .eq('id', tx.toy_id)
  if (archiveError) return c.json({ error: archiveError.message }, 500)

  if (tx.offered_toy_id) {
    const { error: offeredError } = await admin
      .from('toys')
      .update({ archived_at: now, updated_at: now })
      .eq('id', tx.offered_toy_id)
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
  if (!completedTx) return c.json(sanitizeCodes({ ...updated, status: 'completed' }, userId))

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Handoff confirmed. This exchange is complete.',
  })

  // The toy has actually changed hands, so the other requesters can finally be
  // told. Doing this here rather than on accept means a request that never
  // reached a handoff leaves them still in the running.
  const { data: rivals } = await admin
    .from('toy_transactions')
    .select('id, requester_id')
    .eq('toy_id', tx.toy_id)
    .eq('status', 'requested')
    .neq('id', tx.id)
  if (rivals?.length) {
    const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
    const { data: owner } = await admin.from('profiles').select('name').eq('id', tx.owner_id).single()
    for (const rival of rivals) {
      await admin.from('toy_transactions').update({ status: 'rejected', updated_at: now }).eq('id', rival.id)
      await admin.from('toy_transaction_messages').insert({
        transaction_id: rival.id,
        sender_id: tx.owner_id,
        kind: 'system',
        body: 'This toy was handed over to another request, so this one was automatically declined.',
      })
      await admin.from('notifications').insert({
        recipient_id: rival.requester_id,
        type: 'toy_rejected',
        toy_transaction_id: rival.id,
        toy_name: toy?.name ?? 'a toy',
        actor_name: owner?.name ?? 'The owner',
      })
    }
  }

  return c.json(sanitizeCodes(completedTx, userId))
})

export default toyTransactions
