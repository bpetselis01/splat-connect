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
/**
 * GET /api/toy-transactions/open-builds
 *
 * The Makers wanted board: build requests nobody has claimed.
 *
 * Signed-in only, and 064's policy is what admits the rows rather than this
 * filter — a public board of children's first names, ages and suburbs is not
 * something to put behind no account at all, which is why the artboard's
 * signed-out screen is an explainer.
 *
 * The requester's NAME is not returned. The card says "Family in Newtown", and
 * that is the whole of what a maker gets before they claim.
 */
toyTransactions.get('/open-builds', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      'id, tutorial_id, build_brief, travel_km, urgency, child_label, requester_suburb, family_has_toy, requester_id, created_at'
    )
    .eq('type', 'build')
    .eq('status', 'requested')
    .is('owner_id', null)
    .is('owner_org_id', null)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const rows = data ?? []
  const admin = createAdminClient()
  // Named columns only, and every one checked against the table. A select
  // naming a column that does not exist fails the whole query and returns null
  // — which rendered every card on the board as "a guide that is no longer
  // published", with no error anywhere.
  const { data: guides, error: guideError } = await admin
    .from('tutorials')
    .select('id, title, difficulty, status')
    .in('id', rows.map((r) => r.tutorial_id as string))
  if (guideError) return c.json({ error: guideError.message }, 500)
  const guide = new Map((guides ?? []).map((g) => [g.id as string, g]))

  const userId = c.get('userId')
  return c.json(
    rows.map((r) => {
      const { requester_id, ...rest } = r as Record<string, unknown>
      return {
        ...rest,
        tutorial: guide.get(r.tutorial_id as string) ?? null,
        // Whether this is the caller's own ask, so the board can say so rather
        // than offering them a button that would refuse itself.
        mine: requester_id === userId,
      }
    })
  )
})

/**
 * What this record is about, for a notification's `toy_name`.
 *
 * A build has no toy (057) — the maker makes one — so the subject is the guide.
 * Written as one lookup rather than a ternary at each of the five notification
 * sites, all of which did `.eq('id', tx.toy_id).single()` and would now throw
 * on a null id.
 */
async function subjectName(
  admin: ReturnType<typeof createAdminClient>,
  tx: { type: string; toy_id: string | null; tutorial_id: string | null }
): Promise<string> {
  if (tx.type === 'build') {
    if (!tx.tutorial_id) return 'a build'
    const { data } = await admin.from('tutorials').select('title').eq('id', tx.tutorial_id).maybeSingle()
    return (data as { title: string } | null)?.title ?? 'a build'
  }
  if (!tx.toy_id) return 'a toy'
  const { data } = await admin.from('toys').select('name').eq('id', tx.toy_id).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'a toy'
}

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
      '*, toy:toys!toy_transactions_toy_id_fkey(name, cover_photo_url), offered:toys!toy_transactions_offered_toy_id_fkey(name, cover_photo_url), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name), org:organizations!toy_transactions_owner_org_id_fkey(name), tutorial:tutorials(title)'
    )
    .order('updated_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      id: string
      toy_id: string | null
      status: string
      owner_id: string | null
      owner_org_id: string | null
      toy: { name: string; cover_photo_url: string | null } | null
      tutorial: { title: string } | null
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
      rows
        .filter((r) => r.status === 'requested')
        .map((r) => r.toy_id)
        // A build has no toy, so it has no capacity to be blocked by (057).
        .filter((id): id is string => id !== null)
    )) ?? new Set<string>()
  const previews = await lastMessages(
    supabase,
    rows.map((r) => r.id)
  )
  return c.json(
    rows.map((r) => ({
      ...sanitizeCodes(r, userId, ledOrgs),
      toy_name: r.toy?.name ?? '',
      tutorial_title: r.tutorial?.title ?? null,
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
      // The family, named for what they are. A queue that only ever shows one
      // direction — an event's part requests, say — should not have to work out
      // which end of `other_party_name` it is looking at.
      requester_name: r.requester?.name ?? null,
      // Which side of the handoff the caller is on. A leader's own toys and
      // their org's arrive in one list, and nothing else distinguishes them.
      acting_for_org_name: isOwnerSide(r, userId, ledOrgs) ? r.org?.name ?? null : null,
      blocked_by_rival_accept:
        r.status === 'requested' && r.toy_id !== null && blockedToyIds.has(r.toy_id),
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
      // working_photo_url and work_approved_at are here because a build's extra
      // stage alternates sides before the handover (057): without them the
      // badge tells the maker to confirm a handover the family has not
      // approved yet.
      'id, toy_id, status, type, owner_id, owner_org_id, owner_confirmed_at, requester_confirmed_at, working_photo_url, work_approved_at, printing_started_at, ready_at'
    )
    .in('status', ['requested', 'accepted'])
  if (error) return c.json({ error: error.message }, 500)

  const rows = (data ?? []) as Array<
    Parameters<typeof needsAction>[0] & { toy_id: string | null; status: string }
  >
  const admin = createAdminClient()
  const userId = c.get('userId')
  const ledOrgs = await ledOrgIds(admin, userId)
  // Advisory, and fail-open by design: a failed scan must not blank the list.
  const blockedToyIds =
    (await atCapacityToyIds(
      admin,
      rows
        .filter((r) => r.status === 'requested')
        .map((r) => r.toy_id)
        .filter((id): id is string => id !== null)
    )) ?? new Set<string>()
  const count = rows.filter((r) =>
    needsAction(
      { ...r, blocked_by_rival_accept: r.toy_id !== null && blockedToyIds.has(r.toy_id) },
      userId,
      ledOrgs
    )
  ).length
  return c.json({ count })
})

toyTransactions.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name, status), offered:toys!toy_transactions_offered_toy_id_fkey(name, status), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name), org:organizations!toy_transactions_owner_org_id_fkey(name), tutorial:tutorials(title), printer:printers(id, name, suburb, state, materials), print_job_files(quantity, stl_files(id, filename))'
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
    tutorial: { title: string } | null
    printer: { id: string; name: string; suburb: string | null; state: string | null; materials: string[] } | null
    print_job_files: Array<{ quantity: number; stl_files: { id: string; filename: string } | null }> | null
  }
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const blockedToyIds =
    row.status === 'requested' && row.toy_id
      ? (await atCapacityToyIds(admin, [row.toy_id])) ?? new Set<string>()
      : new Set<string>()
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
    tutorial_title: row.tutorial?.title ?? null,
    printer: row.printer ?? null,
    // Flattened here rather than in the client: the embed's shape is a
    // PostgREST detail, and three pages would each have to know it.
    print_files: (row.print_job_files ?? [])
      .filter((f) => f.stl_files)
      .map((f) => ({ id: f.stl_files!.id, filename: f.stl_files!.filename, quantity: f.quantity })),
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

  // The note the requester wrote, as their own first message rather than a
  // column. It is prose addressed to one person — "a line or two about the
  // child is what gets a yes" — and the thread is where prose between these
  // two belongs. It also means the owner's list row previews it for free,
  // through last_message, which a column would not have done.
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note) {
    if (note.length > 2000) return c.json({ error: 'That note is longer than we can store.' }, 400)
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      // 'user', not 'text': the table's check constraint admits exactly
      // 'system' and 'user', and an insert with anything else fails the whole
      // request after the transaction row is already written.
      kind: 'user',
      body: note,
    })
  }

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
    const payload = {
      type: 'toy_message',
      toy_transaction_id: c.req.param('id'),
      toy_name: await subjectName(admin, tx as any),
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

  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_accepted',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
    actor_name: await ownerSideName(admin, tx as any, 'The owner'),
  })

  // Rival requests are deliberately left open here. An accepted handoff can
  // still fall through — if it is withdrawn, the giving side should be able to
  // turn to the next requester rather than having to ask them to request again.
  // They are closed out in the confirm handler, once the stock is really gone.
  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

/*
 * Declining. A print job's refusal carries a reason, because the artboard
 * requires one and because a reason that lives only in the thread cannot be
 * rendered on the list row that needs it. It is optional on the other kinds,
 * where nothing asks for it.
 */
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

  const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length > 500) return c.json({ error: 'The reason is longer than 500 characters.' }, 400)
  // Required on a print job only. "Declining needs a reason" is the artboard's
  // rule for the offer screen, and a printer who says no without one leaves a
  // family with nothing to act on.
  if (tx.type === 'print' && reason.length === 0) {
    return c.json({ error: 'Say why you cannot take this job.' }, 400)
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ status: 'rejected', decline_reason: reason || null, updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: reason ? `Request declined — ${reason}` : 'Request declined.',
  })

  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_rejected',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
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

  const { data: actor } = await admin.from('profiles').select('name').eq('id', userId).single()
  const payload = {
    type: 'toy_withdrawn',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
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

  // Donations are confirmed by the owner alone; exchanges and builds need both
  // — on a build the family is receiving something made for them and their
  // confirmation is the only record that it arrived.
  const canConfirm = tx.type !== 'donation' || isOwner
  if (!canConfirm) return c.json({ error: 'Only the owner confirms a donation' }, 403)

  // A build has a stage before the handover. Confirming past an unapproved
  // working shot would close the record with the family never having seen what
  // was made — the exact thing the extra stage exists to prevent.
  if (tx.type === 'build' && !tx.work_approved_at) {
    return c.json({ error: 'The family approves the working shot before the handover' }, 409)
  }
  // Same rule, the print job's version: nothing is collected before it exists.
  if (tx.type === 'print' && !tx.ready_at) {
    return c.json({ error: 'The parts are not ready to collect yet' }, 409)
  }

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

  /*
   * A build hands over an object that exists nowhere in `toys` — the maker made
   * it — and a print job hands over parts that were never a toy either. Neither
   * has a row to transfer, stock to decrement or a rival request to sweep, so
   * the whole block below is skipped and the record simply closes.
   */
  const movesAToy = tx.type !== 'build' && tx.type !== 'print'

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

  if (!movesAToy) {
    stockRemaining = 0
  } else if (tx.owner_org_id) {
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
  if (movesAToy && tx.offered_toy_id) {
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
  const { data: rivals } = !movesAToy || stockRemaining > 0
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

/**
 * POST /api/toy-transactions/build
 *
 * A family asks somebody to build them an adapted toy from a published guide.
 * It is an ordinary toy transaction with a guide for a subject (057), so
 * everything after this point — the thread, the accept, the codes, the costs —
 * is the code that was already there.
 *
 * Who may be asked is the one judgement here. An organisation, because that is
 * what the product's maker model already is and because its pickup address is
 * on file; or a contributor who has not opted out of a public profile (034),
 * because letting one account address an unsolicited request to any other by id
 * is a spam and safety hole that no amount of UI hides.
 */
toyTransactions.post('/build', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const userId = c.get('userId')
  const admin = createAdminClient()

  const brief = typeof body.build_brief === 'string' ? body.build_brief.trim() : ''
  if (brief.length < 1 || brief.length > 2000) {
    return c.json({ error: 'Say what you need built, in 2000 characters or fewer.' }, 400)
  }

  const { data: tutorial, error: tutorialError } = await admin
    .from('tutorials')
    .select('id, title, status')
    .eq('id', body.tutorial_id)
    .maybeSingle()
  if (tutorialError) {
    if (tutorialError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: tutorialError.message }, 500)
  }
  // A draft or rejected guide is not something to ask a stranger to build: a
  // bare 404, so a prober cannot tell an unapproved guide from a missing one.
  if (!tutorial || tutorial.status !== 'approved') return c.json({ error: 'Not found' }, 404)

  const makerOrgId = typeof body.maker_org_id === 'string' ? body.maker_org_id : null
  const makerId = typeof body.maker_id === 'string' ? body.maker_id : null
  // Neither is now legal, and that is the Makers wanted board: a request with
  // nobody on the other end of it, which any maker within range may claim. 064
  // widened the owner constraint for exactly this shape. Both is still wrong —
  // a request cannot be addressed to two people.
  if (makerOrgId !== null && makerId !== null) {
    return c.json({ error: 'Choose one maker — a person or an organisation, not both.' }, 400)
  }
  const open = makerOrgId === null && makerId === null

  let ownerId: string | null = null
  let ownerOrgId: string | null = null

  if (open) {
    // Nobody to look up. The board is the audience.
  } else if (makerOrgId) {
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('id, status')
      .eq('id', makerOrgId)
      .maybeSingle()
    if (orgError) {
      if (orgError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
      return c.json({ error: orgError.message }, 500)
    }
    if (!org || org.status !== 'active') return c.json({ error: 'Not found' }, 404)
    // The org side of "you cannot request your own toy": a leader asking their
    // own organisation would be accepting their own request.
    if ((await ledOrgIds(admin, userId)).includes(org.id)) {
      return c.json({ error: 'You cannot ask your own organisation for a build' }, 400)
    }
    ownerOrgId = org.id
  } else {
    if (makerId === userId) return c.json({ error: 'You cannot ask yourself for a build' }, 400)
    const { data: maker, error: makerError } = await admin
      .from('profiles')
      .select('id, public_showcase')
      .eq('id', makerId)
      .maybeSingle()
    if (makerError) {
      if (makerError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
      return c.json({ error: makerError.message }, 500)
    }
    // Not "no such account" — somebody who opted out of a public profile is
    // not addressable, and saying which of the two it is would turn this into
    // an account-existence oracle.
    if (!maker || !maker.public_showcase) return c.json({ error: 'Not found' }, 404)
    ownerId = maker.id
  }

  // What the board's cards show, and all of it is deliberately coarse: a
  // suburb rather than an address, a first name and an age rather than a child
  // profile. See 064 — the least a maker needs to decide whether they can help
  // is the most a family should have to publish.
  const short = (field: string, max: number) => {
    const v = typeof body[field] === 'string' ? (body[field] as string).trim() : ''
    return v ? v.slice(0, max) : null
  }
  const travelKm = Number(body.travel_km)
  const board = {
    travel_km: Number.isInteger(travelKm) && travelKm >= 1 && travelKm <= 500 ? travelKm : null,
    urgency: short('urgency', 60),
    child_label: short('child_label', 60),
    requester_suburb: short('requester_suburb', 80),
    family_has_toy: body.family_has_toy === true,
  }
  // An open request goes on a public board with no maker to ask, so the two
  // things a maker decides by have to be on the card itself.
  if (open && (!board.requester_suburb || board.travel_km === null)) {
    return c.json({ error: 'Say which suburb you are in and how far you can travel.' }, 400)
  }

  // One open ask per family per guide per maker. Without it a refresh on the
  // form doubles the request and the maker answers the same thing twice.
  const openAsk = admin
    .from('toy_transactions')
    .select('id')
    .eq('requester_id', userId)
    .eq('tutorial_id', tutorial.id)
    .in('status', ['requested', 'accepted'])
  const { data: existing, error: existingError } = await (
    open
      ? openAsk.is('owner_id', null).is('owner_org_id', null)
      : ownerOrgId
        ? openAsk.eq('owner_org_id', ownerOrgId)
        : openAsk.eq('owner_id', ownerId as string)
  ).maybeSingle()
  if (existingError) return c.json({ error: existingError.message }, 500)
  if (existing) return c.json({ error: 'You already have an open build request with them for this guide' }, 409)

  const { data: tx, error: insertError } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: null,
      offered_toy_id: null,
      tutorial_id: tutorial.id,
      build_brief: brief,
      type: 'build',
      status: 'requested',
      requester_id: userId,
      owner_id: ownerId,
      owner_org_id: ownerOrgId,
      ...board,
    })
    .select()
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)

  const { data: requesterProfile } = await admin.from('profiles').select('name').eq('id', userId).single()

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: open
      ? 'Posted to Makers wanted. Waiting for a maker to claim it.'
      : 'Asked for a build of this guide.',
  })

  // Nobody to notify on an open request — that is what the board is for.
  if (!open) {
    await notifyOwnerSide(admin, tx, {
      type: 'toy_request',
      toy_transaction_id: tx.id,
      toy_name: tutorial.title,
      actor_name: requesterProfile?.name ?? 'A contributor',
    })
  }

  return c.json(tx, 201)
})

/**
 * POST /api/toy-transactions/:id/claim
 *
 * A maker takes an open build request.
 *
 * Deliberately NOT the accept handler. Accept asks "are you the owner side" and
 * this is the step that decides who that is — there is nobody to be yet. What
 * it does after filling owner_id in is exactly what accept does: two handover
 * codes, a system message, a notification.
 *
 * The write is conditional on the row still being unclaimed, so two makers
 * pressing the button in the same second resolve to one winner and one 409
 * rather than to whoever wrote last.
 */
toyTransactions.post('/:id/claim', async (c) => {
  const userId = c.get('userId')
  const admin = createAdminClient()

  const { data: tx, error } = await admin
    .from('toy_transactions')
    .select('id, type, status, requester_id, owner_id, owner_org_id, tutorial_id')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!tx || tx.type !== 'build') return c.json({ error: 'Not found' }, 404)
  if (tx.owner_id || tx.owner_org_id || tx.status !== 'requested') {
    return c.json({ error: 'Somebody has already claimed this one.' }, 409)
  }
  if (tx.requester_id === userId) {
    return c.json({ error: 'You cannot claim your own request' }, 400)
  }

  const { data: claimed, error: claimError } = await admin
    .from('toy_transactions')
    .update({
      owner_id: userId,
      status: 'accepted',
      owner_code: generateCode(),
      requester_code: generateCode(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tx.id)
    // The race guard. Two makers in the same second: one row updated, one none.
    .eq('status', 'requested')
    .is('owner_id', null)
    .is('owner_org_id', null)
    .select()
    .maybeSingle()
  if (claimError) return c.json({ error: claimError.message }, 500)
  if (!claimed) return c.json({ error: 'Somebody has already claimed this one.' }, 409)

  const [{ data: maker }, { data: tutorial }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', userId).maybeSingle(),
    admin.from('tutorials').select('title').eq('id', tx.tutorial_id as string).maybeSingle(),
  ])

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: `${maker?.name ?? 'A maker'} claimed this build.`,
  })

  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_accepted',
    toy_transaction_id: tx.id,
    toy_name: tutorial?.title ?? 'your build request',
    actor_name: maker?.name ?? 'A maker',
  })

  return c.json(sanitizeCodes(claimed, userId, []))
})

/**
 * POST /api/toy-transactions/:id/working-shot
 *
 * The maker's photo of the finished build working. This is the extra stage: the
 * family approves what they are looking at before anybody travels.
 *
 * The object goes to `<transaction_id>/<file>` in the private `build-shots`
 * bucket, because 057's storage policies read the first folder segment as the
 * exchange whose parties may see it. A file written anywhere else is readable
 * by nobody, which is the correct failure direction.
 */
toyTransactions.post('/:id/working-shot', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)

  if (tx.type !== 'build') return c.json({ error: 'Only a build has a working shot' }, 400)
  if (!isOwnerSide(tx as any, userId, ledOrgs)) {
    return c.json({ error: 'Only the maker posts the working shot' }, 403)
  }
  if (tx.status !== 'accepted') return c.json({ error: 'This build is not under way' }, 409)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'A photo is required' }, 400)

  // The caller's own client, so 057's storage policy is what decides — the
  // admin client would bypass the gate this whole path exists to enforce.
  const supabase = createUserClient(c.get('token'))
  const { data: uploaded, error: uploadError } = await supabase.storage
    .from('build-shots')
    .upload(`${tx.id}/${file.name}`, file, { upsert: true })
  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({
      working_photo_url: uploaded.path,
      // Reposting resets the approval: the family approved a different photo,
      // and carrying that approval onto a new one would close the stage with
      // nobody having looked at what is now on the record.
      work_approved_at: null,
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
    body: 'Posted a photo of the build working.',
  })
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'build_shot_posted',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
    actor_name: await ownerSideName(admin, tx as any, 'The maker'),
  })

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

/**
 * POST /api/toy-transactions/:id/approve-work
 *
 * The family accepts the working shot. Only they can: the point of the stage is
 * that the person it was made for looks at it, so a maker approving their own
 * photo would be the stage approving itself.
 */
toyTransactions.post('/:id/approve-work', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)

  if (tx.type !== 'build') return c.json({ error: 'Only a build has a working shot' }, 400)
  if (userId !== tx.requester_id) {
    return c.json({ error: 'Only the family who asked approves the working shot' }, 403)
  }
  if (tx.status !== 'accepted') return c.json({ error: 'This build is not under way' }, 409)
  if (!tx.working_photo_url) return c.json({ error: 'There is no working shot to approve yet' }, 409)
  if (tx.work_approved_at) return c.json({ error: 'You have already approved it' }, 409)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ work_approved_at: now, updated_at: now })
    .eq('id', tx.id)
    .eq('status', 'accepted')
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Approved the working shot. Agree a time and place for the handover.',
  })
  await notifyOwnerSide(admin, tx as any, {
    type: 'build_approved',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
    actor_name: (
      await admin.from('profiles').select('name').eq('id', userId).single()
    ).data?.name ?? 'The family',
  })

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

/**
 * POST /api/toy-transactions/print
 *
 * A family asks one printer for the printed parts of a guide. 058 makes that a
 * toy transaction with a printer and a set of STL files for a subject, so
 * everything after this point is the code that was already there.
 *
 * "Parts come from the guide, never uploaded" is the artboard's rule and the
 * reason there is no upload path within reach of this: the files named must be
 * STL rows belonging to the guide named, which is checked below rather than
 * trusted.
 */
toyTransactions.post('/print', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const userId = c.get('userId')
  const admin = createAdminClient()

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 1000) return c.json({ error: 'The note is longer than 1000 characters.' }, 400)

  const fileIds = Array.isArray(body.stl_file_ids) ? body.stl_file_ids : []
  if (fileIds.length === 0 || !fileIds.every((id: unknown) => typeof id === 'string')) {
    return c.json({ error: 'Tick at least one part to print.' }, 400)
  }

  const { data: printer, error: printerError } = await admin
    .from('printers')
    .select('id, owner_id, owner_org_id, accepting, capacity')
    .eq('id', body.printer_id)
    .maybeSingle()
  if (printerError) {
    if (printerError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: printerError.message }, 500)
  }
  if (!printer) return c.json({ error: 'Not found' }, 404)

  if (printer.owner_id === userId) {
    return c.json({ error: 'You cannot send a job to your own printer' }, 400)
  }
  if (printer.owner_org_id && (await ledOrgIds(admin, userId)).includes(printer.owner_org_id)) {
    return c.json({ error: "You cannot send a job to your own organisation's printer" }, 400)
  }

  // Either closes the machine, and both are checked: the toggle is the
  // deliberate act and the capacity is the honest one. A machine at capacity
  // that still reads "accepting" would take a job it cannot start.
  if (!printer.accepting) return c.json({ error: 'That printer is not taking new jobs' }, 409)
  const { count: openJobs } = await admin
    .from('toy_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('printer_id', printer.id)
    .eq('status', 'accepted')
  if ((openJobs ?? 0) >= printer.capacity) {
    return c.json({ error: 'That printer is full right now' }, 409)
  }

  // Every file must belong to the guide named. Without this a request could
  // name any STL on the platform and the printer would be shown a part from a
  // guide nobody in the conversation has read.
  const { data: files, error: filesError } = await admin
    .from('stl_files')
    .select('id, tutorial_id')
    .in('id', fileIds)
  if (filesError) return c.json({ error: filesError.message }, 500)
  const rows = (files ?? []) as Array<{ id: string; tutorial_id: string }>
  if (rows.length !== fileIds.length || rows.some((f) => f.tutorial_id !== body.tutorial_id)) {
    return c.json({ error: 'Those parts do not all belong to that guide' }, 400)
  }

  const { data: tutorial } = await admin
    .from('tutorials')
    .select('id, title, status')
    .eq('id', body.tutorial_id)
    .maybeSingle()
  if (!tutorial || tutorial.status !== 'approved') return c.json({ error: 'Not found' }, 404)

  const { data: existing, error: existingError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('requester_id', userId)
    .eq('printer_id', printer.id)
    .eq('tutorial_id', tutorial.id)
    .in('status', ['requested', 'accepted'])
    .maybeSingle()
  if (existingError) return c.json({ error: existingError.message }, 500)
  if (existing) return c.json({ error: 'You already have an open job on that printer for this guide' }, 409)

  const { data: tx, error: insertError } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: null,
      offered_toy_id: null,
      tutorial_id: tutorial.id,
      printer_id: printer.id,
      print_note: note || null,
      type: 'print',
      status: 'requested',
      requester_id: userId,
      owner_id: printer.owner_id,
      owner_org_id: printer.owner_org_id,
    })
    .select()
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)

  const { error: linkError } = await admin.from('print_job_files').insert(
    rows.map((f) => ({ transaction_id: tx.id, stl_file_id: f.id }))
  )
  // The files ARE the request. A job with none is a job nobody can fill, so it
  // is rolled back rather than left as a row that looks fine and is not.
  if (linkError) {
    await admin.from('toy_transactions').delete().eq('id', tx.id)
    return c.json({ error: linkError.message }, 500)
  }

  const { data: requesterProfile } = await admin.from('profiles').select('name').eq('id', userId).single()

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: `Asked for ${rows.length} part${rows.length === 1 ? '' : 's'} from this guide.`,
  })

  await notifyOwnerSide(admin, tx, {
    type: 'toy_request',
    toy_transaction_id: tx.id,
    toy_name: tutorial.title,
    actor_name: requesterProfile?.name ?? 'A contributor',
  })

  return c.json(tx, 201)
})

/**
 * POST /api/toy-transactions/print-at-event
 *
 * The other half of a print request: a family asking the HOST of a build day to
 * print their parts before the day, rather than sending them to a machine.
 *
 * Deliberately the same row, the same type and the same status flow as a job
 * sent to a printer. 061 swapped `printer_id is not null` for "exactly one of
 * printer_id and event_id", and nothing else about a print changed. That is
 * what makes the artboard's rule work — a declined request "is told straight
 * away and asked to pick a printer nearby instead", which is one record moving
 * rather than a second one being made — and it is why accept, reject and the
 * thread all work here without knowing events exist.
 *
 * `owner_org_id` is the event's organisation, so isOwnerSide() already answers
 * "may this leader accept it" correctly with no new branch.
 */
toyTransactions.post('/print-at-event', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const userId = c.get('userId')
  const admin = createAdminClient()

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 1000) return c.json({ error: 'The note is longer than 1000 characters.' }, 400)

  const sets = Number(body.part_sets ?? 1)
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
    return c.json({ error: 'Ask for between one and twenty sets.' }, 400)
  }

  const fileIds = Array.isArray(body.stl_file_ids) ? body.stl_file_ids : []
  if (fileIds.length === 0 || !fileIds.every((id: unknown) => typeof id === 'string')) {
    return c.json({ error: 'Tick at least one part to print.' }, 400)
  }

  const { data: event, error: eventError } = await admin
    .from('org_events')
    .select('id, org_id, status, cancelled_at, prints_parts, part_sets_max, title')
    .eq('id', body.event_id)
    .maybeSingle()
  if (eventError) {
    if (eventError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: eventError.message }, 500)
  }
  if (!event || event.status !== 'published' || event.cancelled_at) {
    return c.json({ error: 'Not found' }, 404)
  }
  if (!event.prints_parts) {
    return c.json({ error: 'This host is not printing parts before the day.' }, 409)
  }
  if ((await ledOrgIds(admin, userId)).includes(event.org_id)) {
    return c.json({ error: 'You cannot ask your own organisation to print for you' }, 400)
  }

  // Sets, not requests. The manage screen counts the same way — "You said up to
  // 6 sets; 0 accepted so far" — because six requests for one set each and one
  // request for six are the same amount of filament.
  const { data: accepted } = await admin
    .from('toy_transactions')
    .select('part_sets')
    .eq('event_id', event.id)
    .eq('status', 'accepted')
  const takenSets = (accepted ?? []).reduce((n, r) => n + ((r.part_sets as number) ?? 0), 0)
  if (takenSets + sets > (event.part_sets_max as number)) {
    return c.json({ error: 'The host has no room left for part sets on this one.' }, 409)
  }

  // Every file must belong to the guide named — the same rule the printer path
  // holds, and for the same reason: otherwise a request could name any STL on
  // the platform and the host would be shown a part from a guide nobody in the
  // conversation has read.
  const { data: files, error: filesError } = await admin
    .from('stl_files')
    .select('id, tutorial_id')
    .in('id', fileIds)
  if (filesError) return c.json({ error: filesError.message }, 500)
  const rows = (files ?? []) as Array<{ id: string; tutorial_id: string }>
  if (rows.length !== fileIds.length || rows.some((f) => f.tutorial_id !== body.tutorial_id)) {
    return c.json({ error: 'Those parts do not all belong to that guide' }, 400)
  }

  const { data: tutorial } = await admin
    .from('tutorials')
    .select('id, title, status')
    .eq('id', body.tutorial_id)
    .maybeSingle()
  if (!tutorial || tutorial.status !== 'approved') return c.json({ error: 'Not found' }, 404)

  const { data: existing, error: existingError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('requester_id', userId)
    .eq('event_id', event.id)
    .in('status', ['requested', 'accepted'])
    .maybeSingle()
  if (existingError) return c.json({ error: existingError.message }, 500)
  if (existing) return c.json({ error: 'You already have a part request open with this host' }, 409)

  const { data: tx, error: insertError } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: null,
      offered_toy_id: null,
      tutorial_id: tutorial.id,
      printer_id: null,
      event_id: event.id,
      part_sets: sets,
      print_note: note || null,
      type: 'print',
      status: 'requested',
      requester_id: userId,
      owner_id: null,
      owner_org_id: event.org_id,
    })
    .select()
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)

  const { error: linkError } = await admin.from('print_job_files').insert(
    rows.map((f) => ({ transaction_id: tx.id, stl_file_id: f.id }))
  )
  // The files ARE the request. A job with none is a job nobody can fill, so it
  // is rolled back rather than left as a row that looks fine and is not.
  if (linkError) {
    await admin.from('toy_transactions').delete().eq('id', tx.id)
    return c.json({ error: linkError.message }, 500)
  }

  const { data: requesterProfile } = await admin.from('profiles').select('name').eq('id', userId).single()

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: `Asked for ${sets} set${sets === 1 ? '' : 's'} of parts to be printed before ${event.title}.`,
  })

  await notifyOwnerSide(admin, tx, {
    type: 'toy_request',
    toy_transaction_id: tx.id,
    toy_name: tutorial.title,
    actor_name: requesterProfile?.name ?? 'A contributor',
  })

  return c.json(tx, 201)
})

/**
 * POST /api/toy-transactions/:id/print-started
 *
 * The printer says the job is on the bed. One timestamp, and it is the
 * printer's to set — a requester marking their own job as printing would be
 * reporting on a machine they cannot see.
 */
toyTransactions.post('/:id/print-started', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)

  if (tx.type !== 'print') return c.json({ error: 'Only a print job goes on a bed' }, 400)
  if (!isOwnerSide(tx as any, userId, ledOrgs)) {
    return c.json({ error: 'Only the printer can start the job' }, 403)
  }
  if (tx.status !== 'accepted') return c.json({ error: 'This job is not under way' }, 409)
  if (tx.printing_started_at) return c.json({ error: 'This job is already printing' }, 409)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ printing_started_at: now, updated_at: now })
    .eq('id', tx.id)
    .eq('status', 'accepted')
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'The job is on the bed.',
  })
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'print_started',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
    actor_name: await ownerSideName(admin, tx as any, 'The printer'),
  })

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

/**
 * POST /api/toy-transactions/:id/print-ready
 *
 * Ready to collect, with the photo that proves it. The photo is required by
 * 058's own constraint as well as here: "ready" without one is the state that
 * lets somebody drive across town for nothing.
 */
toyTransactions.post('/:id/print-ready', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)

  if (tx.type !== 'print') return c.json({ error: 'Only a print job is marked ready' }, 400)
  if (!isOwnerSide(tx as any, userId, ledOrgs)) {
    return c.json({ error: 'Only the printer can mark the job ready' }, 403)
  }
  if (tx.status !== 'accepted') return c.json({ error: 'This job is not under way' }, 409)
  if (!tx.printing_started_at) return c.json({ error: 'Start the print before marking it ready' }, 409)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'A photo of the finished part is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data: uploaded, error: uploadError } = await supabase.storage
    .from('print-shots')
    .upload(`${tx.id}/${file.name}`, file, { upsert: true })
  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ ready_photo_url: uploaded.path, ready_at: now, updated_at: now })
    .eq('id', tx.id)
    .eq('status', 'accepted')
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'The parts are printed and ready to collect.',
  })
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'print_ready',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as any),
    actor_name: await ownerSideName(admin, tx as any, 'The printer'),
  })

  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})

export default toyTransactions
