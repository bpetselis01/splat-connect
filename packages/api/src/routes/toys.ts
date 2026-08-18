/**
 * Toy Routes (Protected)
 *
 * Endpoints:
 * - GET   /api/toys              → the caller's toys, newest first
 * - GET   /api/toys/inventory     → stock of every org the caller leads
 * - POST  /api/toys               → create a draft toy, personal or an org's
 * - PATCH /api/toys/:id           → update one
 * - PATCH /api/toys/:id/publish   → publish, once cover photo (and switch
 *                                   photos, if switch_adapted) are present
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
import { createUserClient } from '../supabase/user-client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { pickEditable } from './pick-editable.js'
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
  'cover_photo_url',
  'switch_photo_urls',
  'offer_type',
] as const

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

/** The orgs this caller leads, for scoping every org-toy read and write. */
async function ledOrgIds(token: string, userId: string): Promise<string[]> {
  const { data } = await createUserClient(token)
    .from('org_leaders')
    .select('org_id')
    .eq('user_id', userId)
  return (data ?? []).map((row: { org_id: string }) => row.org_id)
}

/** Fields still missing before a toy may be published. */
export function missingPublishFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
  offer_type: OfferType | null
}): string[] {
  const missing: string[] = []
  if (!toy.cover_photo_url) missing.push('Cover photo')
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0) missing.push('Switch photo')
  if (!toy.offer_type) missing.push('Offer type')
  return missing
}

toys.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toys')
    .select('*')
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
  const orgIds = await ledOrgIds(c.get('token'), c.get('userId'))
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
  if (orgId && !(await ledOrgIds(c.get('token'), c.get('userId'))).includes(orgId)) {
    return c.json({ error: 'You do not lead that organisation' }, 403)
  }

  const quantity = orgId ? readQuantity(body.quantity) : 1
  if (quantity === null) return c.json({ error: 'Quantity must be a whole number, 1 or more' }, 400)

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
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

/**
 * "Mine, or my organisation's" as a PostgREST filter.
 *
 * The :id handlers scope by ownership themselves as defence in depth on top of
 * RLS, which is why they answer 404 and never 403 for someone else's row. That
 * property is preserved here — a leader gets the same 404 for another org's toy
 * that a stranger gets.
 */
function ownedByCaller(userId: string, orgIds: string[]): string {
  const clauses = [`owner_id.eq.${userId}`]
  if (orgIds.length) clauses.push(`owner_org_id.in.(${orgIds.join(',')})`)
  return clauses.join(',')
}

toys.patch('/:id', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(c.get('token'), c.get('userId'))

  // Read first, to know whether quantity is an editable field on this row. A
  // person's toy has no stock to top up, and 033 would reject the write anyway.
  const { data: existing, error: readError } = await supabase
    .from('toys')
    .select('owner_org_id')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (readError) {
    if (readError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: readError.message }, 500)
  }
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const isOrgToy = Boolean(existing.owner_org_id)
  if (isOrgToy && body.quantity !== undefined && readQuantity(body.quantity) === null) {
    return c.json({ error: 'Quantity must be a whole number, 1 or more' }, 400)
  }

  const { data, error } = await supabase
    .from('toys')
    .update(editableFrom(body, isOrgToy))
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .is('archived_at', null)
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

toys.patch('/:id/publish', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(c.get('token'), c.get('userId'))
  const { data: existing, error: fetchError } = await supabase
    .from('toys')
    .select('cover_photo_url, switch_adapted, switch_photo_urls, offer_type')
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
  const orgIds = await ledOrgIds(c.get('token'), c.get('userId'))
  const { data, error } = await supabase
    .from('toys')
    .delete()
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .is('archived_at', null)
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
