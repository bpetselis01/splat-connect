import { Hono, type Context } from 'hono'
import { randomInt } from 'node:crypto'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyTransactions = new Hono<{ Variables: AuthVariables }>()

export const INVALID_TEXT_REPRESENTATION = '22P02'
export const RLS_VIOLATION = '42501'

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
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
      owner_id: string
      toy: { name: string } | null
      offered: { name: string } | null
      owner: { name: string } | null
      requester: { name: string } | null
    }
  >
  return c.json(
    rows.map((r) => ({
      ...r,
      toy_name: r.toy?.name ?? '',
      offered_toy_name: r.offered?.name ?? null,
      other_party_name: r.owner_id === userId ? r.requester?.name ?? '' : r.owner?.name ?? '',
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

  const row = data as unknown as Record<string, unknown> & {
    toy: { name: string } | null
    offered: { name: string } | null
    owner: { name: string } | null
    requester: { name: string } | null
  }
  return c.json({
    ...row,
    toy_name: row.toy?.name ?? '',
    offered_toy_name: row.offered?.name ?? null,
    owner_name: row.owner?.name ?? '',
    requester_name: row.requester?.name ?? '',
    messages: messages ?? [],
  })
})

toyTransactions.post('/', async (c) => {
  const body = await c.req.json()
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
      .select('id, owner_id, archived_at')
      .eq('id', body.offered_toy_id)
      .maybeSingle()
    if (offeredError) return c.json({ error: offeredError.message }, 500)
    if (!offered || offered.owner_id !== userId || offered.archived_at) {
      return c.json({ error: 'Choose one of your own, active toys to offer' }, 400)
    }
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
  const body = await c.req.json()
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
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id) return c.json({ error: 'Only the owner may accept' }, 403)
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const admin = createAdminClient()
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('pickup_line1, pickup_suburb, pickup_state, pickup_postcode')
    .eq('id', userId)
    .single()

  const ownerCode = generateCode()
  const requesterCode = generateCode()
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({
      status: 'accepted',
      owner_code: ownerCode,
      requester_code: requesterCode,
      pickup_line1: ownerProfile?.pickup_line1 ?? null,
      pickup_suburb: ownerProfile?.pickup_suburb ?? null,
      pickup_state: ownerProfile?.pickup_state ?? null,
      pickup_postcode: ownerProfile?.pickup_postcode ?? null,
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

  // Only one accepted handoff may be in flight per toy, so every other open
  // request on the same toy is closed out automatically.
  const { data: rivals } = await admin
    .from('toy_transactions')
    .select('id, requester_id')
    .eq('toy_id', tx.toy_id)
    .eq('status', 'requested')
    .neq('id', tx.id)
  for (const rival of rivals ?? []) {
    await admin.from('toy_transactions').update({ status: 'rejected', updated_at: now }).eq('id', rival.id)
    await admin.from('toy_transaction_messages').insert({
      transaction_id: rival.id,
      sender_id: userId,
      kind: 'system',
      body: 'This toy was accepted by another request, so this one was automatically declined.',
    })
    await admin.from('notifications').insert({
      recipient_id: rival.requester_id,
      type: 'toy_rejected',
      toy_transaction_id: rival.id,
      toy_name: toy?.name ?? 'a toy',
      actor_name: ownerName?.name ?? 'The owner',
    })
  }

  return c.json(updated)
})

export default toyTransactions
