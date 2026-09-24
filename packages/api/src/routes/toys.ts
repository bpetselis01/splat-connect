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
 * - DELETE /api/toys/:id          → remove one
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
import { createUserClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { pickEditable } from './pick-editable.js'
import { ledOrgIds, ownedByCaller } from '../toy-access.js'
import { removeDroppedPhotos } from '../photo-storage.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { OfferType } from '@splat-connect/types'

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
] as const

const FACT_TEXT = { batteries: 60, switch_fitting: 60, volume: 40 } as const

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
// reach a column the confirm branch assumes is 1.
const ORG_EDITABLE = [...EDITABLE, 'quantity'] as const

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
    .select('*, save_count, request_count')
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
    .select('*, organizations(name)')
    .in('owner_org_id', orgIds)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
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

toys.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
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
