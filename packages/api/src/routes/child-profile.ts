/**
 * Child Profile Routes (Protected, parent-only)
 *
 * One child profile per parent account (enforced by a unique parent_id in the DB).
 *
 * Endpoints:
 * - GET /api/child-profile   → the caller's child_profiles row, or null if not created yet
 * - PUT /api/child-profile   → upsert the caller's editable fields (autosave target)
 *
 * Both reject non-parent roles with 403. Writes go through the user client so
 * Postgres RLS (parent_id = auth.uid()) is the real authorization boundary.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const childProfile = new Hono<{ Variables: AuthVariables }>()

// Only parents own a child profile. Admin/contributor get a fast 403 (RLS would
// deny them anyway, but this avoids a pointless round-trip and a confusing empty result).
childProfile.use('*', async (c, next) => {
  if (c.get('role') !== 'parent') return c.json({ error: 'Parent role required' }, 403)
  await next()
})

// Whitelist of client-editable columns. parent_id and updated_at are set by the
// server; id/role/etc. from the body are ignored — trust-boundary input filtering.
const EDITABLE = [
  'age',
  'primary_diagnosis', 'macs_level', 'macs_source', 'hand_involvement', 'assist_hand', 'bfmf_score', 'bfmf_source',
  'challenges', 'challenge_other', 'grip_type', 'env_context',
  'palm_width_mm', 'wrist_circ_mm', 'needs_arm_attachment', 'forearm_length_mm', 'hand_dominance', 'sensory_preferences',
] as const

childProfile.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', c.get('userId'))
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data) // null when the parent hasn't created a profile yet
})

childProfile.put('/', async (c) => {
  const body = await c.req.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid body' }, 400)
  }
  const row: Record<string, unknown> = {
    parent_id: c.get('userId'),
    updated_at: new Date().toISOString(),
  }
  for (const key of EDITABLE) {
    if (key in body) row[key] = body[key]
  }
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .upsert(row, { onConflict: 'parent_id' })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default childProfile
