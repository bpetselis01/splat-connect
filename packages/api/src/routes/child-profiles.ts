/**
 * Child Profile Routes (Protected)
 *
 * A parent may hold any number of child profiles. 003 used a unique parent_id
 * rather than a primary key so this would be one dropped constraint; 020 dropped
 * it.
 *
 * Endpoints:
 * - GET    /api/child-profiles      → the caller's children, oldest first
 * - POST   /api/child-profiles      → create one
 * - PATCH  /api/child-profiles/:id  → update one
 * - DELETE /api/child-profiles/:id  → remove one
 *
 * There is deliberately no GET /:id. The edit page needs a child's position to
 * render its "Child N" fallback label, which a single-row fetch cannot supply,
 * so it reads the collection and finds its child there.
 *
 * Any signed-in account may hold child profiles — parent and contributor are not
 * exclusive. Writes go through the user client so Postgres RLS
 * (parent_id = auth.uid()) is the primary authorization boundary, as it always
 * was. The :id handlers also scope their query by parent_id themselves, as
 * defence in depth: RLS grants admins a bypass ("Admin full access to
 * child_profiles" in 003_ability_profile.sql), so without the explicit
 * parent_id check an admin token could PATCH or DELETE any child profile by
 * id. With it, another parent's row is invisible to the query for every
 * caller, which is why :id routes answer 404 and never 403 — a 403 would
 * confirm the row exists.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { pickEditable } from './pick-editable.js'
import type { AuthVariables } from '../middleware/auth.js'

const childProfiles = new Hono<{ Variables: AuthVariables }>()

// Whitelist of client-editable columns. parent_id, created_at and updated_at are
// set by the server; id/role/etc. from the body are ignored — trust-boundary
// input filtering.
const EDITABLE = [
  'name', 'age',
  'primary_diagnosis', 'macs_level', 'macs_source', 'hand_involvement', 'assist_hand', 'bfmf_score', 'bfmf_source',
  'challenges', 'challenge_other', 'grip_type', 'env_context',
  'palm_width_mm', 'wrist_circ_mm', 'needs_arm_attachment', 'forearm_length_mm', 'hand_dominance', 'sensory_preferences',
] as const

/** Returns the whitelisted subset of a request body, or null if it isn't an object. */
function editableFrom(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return { ...pickEditable(body as Record<string, unknown>, EDITABLE), updated_at: new Date().toISOString() }
}

childProfiles.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', c.get('userId'))
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

childProfiles.post('/', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .insert({ ...row, parent_id: c.get('userId') })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

childProfiles.patch('/:id', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .update(row)
    .eq('id', c.req.param('id'))
    .eq('parent_id', c.get('userId'))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

childProfiles.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('parent_id', c.get('userId'))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

export default childProfiles
