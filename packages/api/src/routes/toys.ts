/**
 * Toy Routes (Protected)
 *
 * Endpoints:
 * - GET   /api/toys              → the caller's toys, newest first
 * - POST  /api/toys               → create a draft toy
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

function editableFrom(body: Record<string, unknown>) {
  return { ...pickEditable(body, EDITABLE), updated_at: new Date().toISOString() }
}

/** Fields still missing before a toy may be published. */
export function missingPublishFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
}): string[] {
  const missing: string[] = []
  if (!toy.cover_photo_url) missing.push('Cover photo')
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0) missing.push('Switch photo')
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

toys.post('/', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toys')
    .insert({
      name: body.name,
      description: body.description ?? null,
      condition: body.condition,
      owner_id: c.get('userId'),
      status: 'draft',
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

toys.patch('/:id', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toys')
    .update(editableFrom(body))
    .eq('id', c.req.param('id'))
    .eq('owner_id', c.get('userId'))
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
  const { data: existing, error: fetchError } = await supabase
    .from('toys')
    .select('cover_photo_url, switch_adapted, switch_photo_urls')
    .eq('id', c.req.param('id'))
    .eq('owner_id', c.get('userId'))
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
    .eq('owner_id', c.get('userId'))
    .select()
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

toys.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toys')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('owner_id', c.get('userId'))
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
