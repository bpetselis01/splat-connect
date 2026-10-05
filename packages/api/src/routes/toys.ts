/**
 * Toy Routes (Protected)
 *
 * Endpoints:
 * - GET   /api/toys              → the caller's toys, newest first
 * - GET   /api/toys/inventory     → stock of every org the caller leads
 * - POST  /api/toys               → create a draft toy, personal or an org's
 * - PATCH /api/toys/:id           → update one
 * - PATCH /api/toys/:id/publish   → publish, once a photo (and one tagged as
 *                                   showing the switch, if switch_adapted) exists
 * - PUT   /api/toys/:id/picks     → replace the hand-picked "Also worth a look"
 * - DELETE /api/toys/:id          → remove one with no handovers on record (409
 *                                   otherwise: 026's cascade would erase them)
 *
 * There is deliberately no GET /:id — nothing in the UI needs a single-row
 * fetch outside the collection.
 *
 * Writes go through the user client so Postgres RLS (owner_id = auth.uid())
 * is the primary authorization boundary. The :id handlers also scope their
 * query by owner_id themselves as defence in depth, which is why they answer
 * 404 and never 403 for another owner's row — a 403 would confirm the row
 * exists. A malformed :id fails uuid parsing in Postgres (22P02), which is
 * mapped to 404 rather than 500 for the same reason.
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { pickEditable } from './pick-editable.js'
import { ledOrgIds, ownedByCaller } from '../toy-access.js'
import { removeDroppedPhotos } from '../photo-storage.js'
import { chunk } from '../chunk.js'
import type { AuthVariables } from '../middleware/auth.js'
import { readSuits, SUITS_FIELDS, type OfferType, type ToyPickInput } from '@splat-connect/types'

const toys = new Hono<{ Variables: AuthVariables }>()

// Whitelist of client-editable columns. owner_id, status, created_at and
// updated_at are set by the server; id/etc. from the body are ignored — a
// trust-boundary filter so a spoofed owner_id in the body can't reassign a toy.
const EDITABLE = [
  'name',
  'description',
  'condition',
  'switch_adapted',
  'photo_urls',
  'switch_photo_url',
  'offer_type',
  'age_min',
  'age_max',
  'batteries',
  'switch_fitting',
  'volume',
  'tutorial_id',
  'paused_at',
  'picks_mode',
  // 127: who it suits.
  ...SUITS_FIELDS,
] as const

const FACT_TEXT = { batteries: 60, switch_fitting: 60, volume: 40 } as const

/**
 * A timestamp the holder sets (100's paused_at, 101's retired_at): an ISO
 * date, or null to clear it. Anything else would reach Postgres as a cast
 * error and come back a 500.
 */
function badTimestamp(body: Record<string, unknown>, key: string): boolean {
  if (!(key in body) || body[key] === null) return false
  return typeof body[key] !== 'string' || Number.isNaN(Date.parse(body[key] as string))
}

/**
 * 075's facts, checked and normalised at the trust boundary so a bad value is a
 * 400 with words, not a check-constraint 500. Blank text means "clear it" (the
 * column refuses an empty string). The age order is checked against the row's
 * current values, because a PATCH may send only one end. Mutates `body`.
 */
async function checkFacts(
  supabase: ReturnType<typeof createUserClient>,
  body: Record<string, unknown>,
  current: { age_min: number | null; age_max: number | null } = { age_min: null, age_max: null }
): Promise<string | null> {
  // 127: who it suits, checked against the answer lists and tidied in place.
  const suits = readSuits(body)
  if (typeof suits === 'string') return suits
  Object.assign(body, suits)
  for (const key of ['age_min', 'age_max'] as const) {
    if (!(key in body)) continue
    const v = body[key] === '' ? null : body[key]
    if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 18)) {
      return 'Ages must be whole years from 0 to 18'
    }
    body[key] = v
  }
  const min = 'age_min' in body ? (body.age_min as number | null) : current.age_min
  const max = 'age_max' in body ? (body.age_max as number | null) : current.age_max
  if (min !== null && max !== null && max < min) return 'The oldest age cannot be below the youngest'

  for (const [key, limit] of Object.entries(FACT_TEXT)) {
    if (!(key in body)) continue
    const v = body[key]
    if (v === null) continue
    if (typeof v !== 'string') return `${key} must be text`
    const t = v.trim()
    if (t.length > limit) return `Keep ${key.replace('_', ' ')} to ${limit} characters`
    body[key] = t || null
  }

  if ('tutorial_id' in body && body.tutorial_id !== null && body.tutorial_id !== '') {
    if (typeof body.tutorial_id !== 'string') return 'That guide was not found'
    // Only an approved guide can be linked: a listing must not point families
    // at a draft nobody has reviewed. A malformed id errors here, same answer.
    const { data } = await supabase
      .from('tutorials')
      .select('id')
      .eq('id', body.tutorial_id)
      .eq('status', 'approved')
      .maybeSingle()
    if (!data) return 'Link a guide that is published in the library'
  } else if ('tutorial_id' in body) {
    body.tutorial_id = null
  }
  return null
}

// quantity is deliberately NOT in EDITABLE. It is meaningful only for an
// organisation's stock, and 033's toys_person_single_unit constraint would
// reject a person setting it anyway — this keeps the rejection at the trust
// boundary rather than at the database, and keeps the individual path unable to
// reach a column the confirm branch assumes is 1. retired_at/retired_note
// likewise: 101 allows them on org toys only.
const ORG_EDITABLE = [...EDITABLE, 'quantity', 'retired_at', 'retired_note'] as const

/**
 * Toy ids among `ids` that any toy_transactions row names, as the toy or as
 * the offered one. Admin client: the caller may not be a party to every
 * handover (a person's toy that changed hands carries its giver's rows).
 * Each id goes in the URL twice, so chunks of 50 stay under chunk.ts's limit.
 */
async function idsWithHistory(ids: string[]): Promise<Set<string>> {
  const wanted = new Set(ids)
  const admin = createAdminClient()
  const pages = await Promise.all(
    chunk(ids, 50).map((part) => {
      const list = part.join(',')
      return admin
        .from('toy_transactions')
        .select('toy_id, offered_toy_id')
        .or(`toy_id.in.(${list}),offered_toy_id.in.(${list})`)
    })
  )
  const found = new Set<string>()
  for (const { data, error } of pages) {
    if (error) throw new Error(error.message)
    for (const t of data ?? []) {
      if (t.toy_id && wanted.has(t.toy_id)) found.add(t.toy_id)
      if (t.offered_toy_id && wanted.has(t.offered_toy_id)) found.add(t.offered_toy_id)
    }
  }
  return found
}

function editableFrom(body: Record<string, unknown>, isOrgToy = false) {
  const fields = isOrgToy ? ORG_EDITABLE : EDITABLE
  return { ...pickEditable(body, fields), updated_at: new Date().toISOString() }
}

/** Whole numbers only, and at least one — "add 0 of these" is not a request
 *  anyone means to make, and batch add is the only way quantity is ever set. */
function readQuantity(value: unknown): number | null {
  if (value === undefined || value === null) return 1
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null
  return value
}

/** Fields still missing before a toy may be published. */
function missingPublishFields(toy: {
  photo_urls: string[]
  switch_adapted: boolean
  switch_photo_url: string | null
  offer_type: OfferType | null
}): string[] {
  const missing: string[] = []
  if (toy.photo_urls.length === 0) missing.push('A photo')
  // Not "two photos": the rule is that the switch was pictured, and one of the
  // five has to be the one that shows it. 053's toys_switch_photo_member keeps
  // that pointer inside the array.
  if (toy.switch_adapted && !toy.switch_photo_url) missing.push('A photo showing the switch')
  if (!toy.offer_type) missing.push('Offer type')
  return missing
}

toys.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  // The two computed fields (073) are the owner's "How it is doing" tiles.
  // Named here and nowhere else: only the owner is told how a toy is doing.
  const { data, error } = await supabase
    .from('toys')
    .select('*, save_count, request_count, toy_picks(position, entity_type, entity_id)')
    .eq('owner_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// An organisation's stock, across every org the caller leads. Kept off GET /
// deliberately: My Toys means the toys this person holds, and mixing an org's
// shelf into it would leave a leader unable to tell what is theirs to give away
// personally. Declared before '/:id' so 'inventory' is not swallowed as an id.
toys.get('/inventory', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
  if (orgIds.length === 0) return c.json([])
  const { data, error } = await supabase
    .from('toys')
    .select('*, organizations(name), toy_picks(position, entity_type, entity_id)')
    .in('owner_org_id', orgIds)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  // has_history: Remove is offered only on a toy no handover names.
  const history = await idsWithHistory(data.map((t) => t.id))
  return c.json(data.map((t) => ({ ...t, has_history: history.has(t.id) })))
})

toys.post('/', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))

  // owner_org_id in the body is a claim, not a fact: it is checked against the
  // caller's leaderships here and by the insert policy in 033, so a spoofed one
  // fails twice. Absent, this is an ordinary personal toy and nothing changes.
  const orgId = typeof body.owner_org_id === 'string' ? body.owner_org_id : null
  if (orgId && !(await ledOrgIds(supabase, c.get('userId'))).includes(orgId)) {
    return c.json({ error: 'You do not lead that organisation' }, 403)
  }

  if (typeof body.name !== 'string' || !body.name.trim()) return c.json({ error: 'Give the toy a name.' }, 400)
  const quantity = orgId ? readQuantity(body.quantity) : 1
  if (quantity === null) return c.json({ error: 'Quantity must be a whole number, 1 or more' }, 400)

  const factError = await checkFacts(supabase, body)
  if (factError) return c.json({ error: factError }, 400)
  const facts = pickEditable(body, ['age_min', 'age_max', 'batteries', 'switch_fitting', 'volume', 'tutorial_id'])

  const { data, error } = await supabase
    .from('toys')
    .insert({
      name: body.name,
      description: body.description ?? null,
      condition: body.condition,
      owner_id: orgId ? null : c.get('userId'),
      owner_org_id: orgId,
      quantity,
      status: 'draft',
      ...facts,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

toys.patch('/:id', async (c) => {
  const body = await c.req.json()
  if (badTimestamp(body, 'paused_at')) {
    return c.json({ error: 'Pausing needs a date, or nothing to take requests again.' }, 400)
  }
  if ('picks_mode' in body && body.picks_mode !== 'auto' && body.picks_mode !== 'picked') {
    return c.json({ error: 'Show picks automatically or hand-picked.' }, 400)
  }
  if ('name' in body && !(typeof body.name === 'string' && body.name.trim())) {
    return c.json({ error: 'Give the toy a name.' }, 400)
  }
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))

  // Read first, to know whether quantity is an editable field on this row. A
  // person's toy has no stock to top up, and 033 would reject the write anyway.
  const { data: existing, error: readError } = await supabase
    .from('toys')
    .select('owner_org_id, photo_urls, age_min, age_max')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (readError) {
    if (readError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: readError.message }, 500)
  }
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const factError = await checkFacts(supabase, body, existing)
  if (factError) return c.json({ error: factError }, 400)

  const isOrgToy = Boolean(existing.owner_org_id)
  if (isOrgToy && body.quantity !== undefined && readQuantity(body.quantity) === null) {
    return c.json({ error: 'Quantity must be a whole number, 1 or more' }, 400)
  }
  if (isOrgToy) {
    if (badTimestamp(body, 'retired_at')) return c.json({ error: 'Retiring needs a date, or nothing to bring it back.' }, 400)
    if ('retired_note' in body && body.retired_note !== null) {
      if (typeof body.retired_note !== 'string' || body.retired_note.trim().length > 80) {
        return c.json({ error: 'Keep the reason to 80 characters.' }, 400)
      }
      body.retired_note = body.retired_note.trim() || null
    }
    // A family waiting on this toy would be left with a request nobody can
    // fill. Admin client: the count covers every party's open rows.
    if (typeof body.retired_at === 'string') {
      const id = c.req.param('id')
      const { count, error: openError } = await createAdminClient()
        .from('toy_transactions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'accepted'])
        .or(`toy_id.eq.${id},offered_toy_id.eq.${id}`)
      if (openError) return c.json({ error: openError.message }, 500)
      if (count) return c.json({ error: 'This toy has open requests. Answer them first, then retire it.' }, 409)
    }
  }

  // A toy that has a photo keeps one. Not a check constraint, because a draft
  // legitimately starts empty and would be unsaveable at creation — the rule is
  // "do not go back to none", which is about the transition rather than the row,
  // and only a handler can see a transition.
  if (Array.isArray(body.photo_urls) && body.photo_urls.length === 0 && (existing.photo_urls?.length ?? 0) > 0) {
    return c.json(
      { error: 'Every toy needs at least one photo. Add another before removing this one.' },
      400
    )
  }

  const { data, error } = await supabase
    .from('toys')
    .update(editableFrom(body, isOrgToy))
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)

  // After the write, not before: a photo's object outlives a save that failed.
  await removeDroppedPhotos('toy-photos-library', existing.photo_urls, data.photo_urls)
  return c.json(data)
})

toys.patch('/:id/publish', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
  const { data: existing, error: fetchError } = await supabase
    .from('toys')
    .select('photo_urls, switch_adapted, switch_photo_url, offer_type')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (fetchError) {
    if (fetchError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: fetchError.message }, 500)
  }
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const missing = missingPublishFields(existing)
  if (missing.length > 0) return c.json({ error: 'Missing required fields', missing }, 400)

  const { data, error } = await supabase
    .from('toys')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .select()
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

/**
 * PUT /api/toys/:id/picks — the holder's hand-picked "Also worth a look",
 * replaced whole, in the order sent. Up to three, each one of the holder's own
 * listed (not retired) toys or a published guide; 102's position and type checks back this.
 */
toys.put('/:id/picks', async (c) => {
  const body = await c.req.json().catch(() => null)
  const picks = (body as { picks?: unknown } | null)?.picks
  if (!Array.isArray(picks) || picks.length > 3) return c.json({ error: 'Pick up to three.' }, 400)
  const valid = picks.every(
    (p): p is ToyPickInput =>
      !!p && typeof p === 'object' && (p.entity_type === 'toy' || p.entity_type === 'tutorial') && typeof p.entity_id === 'string'
  )
  if (!valid) return c.json({ error: 'Each pick is one of your toys or a guide.' }, 400)
  const list = picks as ToyPickInput[]
  if (new Set(list.map((p) => `${p.entity_type}:${p.entity_id}`)).size !== list.length) {
    return c.json({ error: 'Pick each one once.' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
  const { data: toy, error } = await supabase
    .from('toys')
    .select('id, owner_id, owner_org_id')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!toy) return c.json({ error: 'Not found' }, 404)

  const toyIds = list.filter((p) => p.entity_type === 'toy').map((p) => p.entity_id)
  if (toyIds.includes(toy.id)) return c.json({ error: 'A toy cannot point at itself.' }, 400)
  if (toyIds.length) {
    // A malformed id errors here and returns no rows: the same 400.
    const { data: own } = await supabase
      .from('toys')
      .select('id')
      .in('id', toyIds)
      .eq(toy.owner_org_id ? 'owner_org_id' : 'owner_id', toy.owner_org_id ?? toy.owner_id)
      .eq('status', 'published')
      .is('retired_at', null)
    if ((own ?? []).length !== toyIds.length) return c.json({ error: 'Pick from your own listed toys.' }, 400)
  }
  const guideIds = list.filter((p) => p.entity_type === 'tutorial').map((p) => p.entity_id)
  if (guideIds.length) {
    const { data: approved } = await supabase.from('tutorials').select('id').in('id', guideIds).eq('status', 'approved')
    if ((approved ?? []).length !== guideIds.length) {
      return c.json({ error: 'Pick guides that are published in the library.' }, 400)
    }
  }

  const { error: clearError } = await supabase.from('toy_picks').delete().eq('toy_id', toy.id)
  if (clearError) return c.json({ error: clearError.message }, 500)
  const rows = list.map((p, i) => ({ toy_id: toy.id, position: i + 1, entity_type: p.entity_type, entity_id: p.entity_id }))
  if (rows.length) {
    const { error: insertError } = await supabase.from('toy_picks').insert(rows)
    if (insertError) return c.json({ error: insertError.message }, 500)
  }
  return c.json({ picks: list.map((p, i) => ({ position: i + 1, ...p })) })
})

toys.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
  // Holder first, so an outsider gets the same 404 whether or not it has history.
  const { data: held, error: readError } = await supabase
    .from('toys')
    .select('id')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (readError) {
    if (readError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: readError.message }, 500)
  }
  if (!held) return c.json({ error: 'Not found' }, 404)
  // 026's on delete cascade would take the toy's handovers with it, and
  // "Delivered all time" with them. A toy with history stays.
  if ((await idsWithHistory([held.id])).size > 0) {
    return c.json({ error: "This toy has handovers on record, so it can't be deleted." }, 409)
  }
  const { data, error } = await supabase
    .from('toys')
    .delete()
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

export default toys
