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
import { ACCESS, CHILD_MEASURES, ENJOYS, EVERYDAY_NEEDS, HELPS_WITH, PRESS_FORCE } from '@splat-connect/types'
import { createUserClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { pickEditable } from './pick-editable.js'
import type { AuthVariables } from '../middleware/auth.js'

const childProfiles = new Hono<{ Variables: AuthVariables }>()

// Whitelist of client-editable columns. parent_id, created_at and updated_at are
// set by the server; id/role/etc. from the body are ignored — trust-boundary
// input filtering.
//
// Only the questions the forms ask are writable: the four child questions
// (128's CHILD_QUESTIONS), everyday needs (079) and the measurements (120). The older ability/
// needs columns (MACS, BFMF, grip, sensory…) are no longer asked, so they are
// no longer accepted either — APP 3 minimisation. palm_width_mm came back in
// 120 by decision (2026-09-30: "Measurements as an optional step"). The rest
// stay in the table and still come back on GET until a decision drops them.
const EDITABLE = [
  'age', 'helps_with', 'access', 'one_hand', 'press_force', 'enjoys',
  'everyday_needs', 'palm_width_mm', 'reach_cm', 'tray_mm',
] as const

// Every ChildProfile column except the retired name. Explicit so the response
// stays name-free for as long as the column exists, and `*` cannot bring it back.
const COLUMNS = [
  'id', 'parent_id', 'age', 'macs_level', 'macs_source', 'hand_involvement', 'assist_hand', 'bfmf_score', 'bfmf_source',
  'challenges', 'challenge_other', 'grip_type', 'env_context', 'palm_width_mm', 'wrist_circ_mm', 'needs_arm_attachment',
  'forearm_length_mm', 'hand_dominance', 'sensory_preferences', 'helps_with', 'access', 'one_hand', 'press_force', 'enjoys',
  'everyday_needs', 'reach_cm', 'tray_mm', 'created_at', 'updated_at',
].join(', ')

const valuesOf = (vocab: readonly { value: string }[]) => vocab.map((o) => o.value) as readonly string[]
const SINGLE_CHOICE: Record<string, readonly string[]> = {
  press_force: valuesOf(PRESS_FORCE),
}
const MANY_CHOICE: Record<string, readonly string[]> = {
  helps_with: valuesOf(HELPS_WITH),
  access: valuesOf(ACCESS),
  enjoys: valuesOf(ENJOYS),
  everyday_needs: valuesOf(EVERYDAY_NEEDS),
}

/**
 * Returns the whitelisted subset of a request body, a string naming the first
 * field outside its vocabulary, or null if the body isn't an object. The table's
 * check constraints enforce the same sets; answering 400 here keeps a bad value
 * from surfacing as a 500 with a constraint name in it.
 */
function editableFrom(body: unknown): Record<string, unknown> | string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const row = pickEditable(body as Record<string, unknown>, EDITABLE)
  for (const [key, allowed] of Object.entries(SINGLE_CHOICE)) {
    const v = row[key]
    if (v !== undefined && v !== null && !allowed.includes(v as string)) return `${key} must be one of ${allowed.join(', ')}`
  }
  for (const [key, allowed] of Object.entries(MANY_CHOICE)) {
    const v = row[key]
    if (v === undefined) continue
    if (!Array.isArray(v) || v.some((x) => !allowed.includes(x as string))) return `${key} must be a list drawn from ${allowed.join(', ')}`
    row[key] = [...new Set(v)]
  }
  if (row.one_hand !== undefined && typeof row.one_hand !== 'boolean') return 'one_hand must be true or false'
  // 120's CHECKs hold the same ranges; answering here keeps a typo from
  // surfacing as a 500 naming a constraint.
  for (const m of CHILD_MEASURES) {
    const v = row[m.field]
    if (v === undefined || v === null) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min || v > m.max) {
      return `${m.field} must be a number from ${m.min} to ${m.max}`
    }
  }
  return { ...row, updated_at: new Date().toISOString() }
}

childProfiles.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .select(COLUMNS)
    .eq('parent_id', c.get('userId'))
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

childProfiles.post('/', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  if (typeof row === 'string') return c.json({ error: row }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .insert({ ...row, parent_id: c.get('userId') })
    .select(COLUMNS)
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

childProfiles.patch('/:id', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  if (typeof row === 'string') return c.json({ error: row }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .update(row)
    .eq('id', c.req.param('id'))
    .eq('parent_id', c.get('userId'))
    .select(COLUMNS)
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
    .select(COLUMNS)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

export default childProfiles
