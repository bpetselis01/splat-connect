/**
 * Contributor profile routes: GET/PATCH /api/contributors/me.
 *
 * Only `name` is mutable. `role` and `email` are frozen by the
 * profiles_freeze_identity trigger (009) — role was an escalation path, and
 * email mirrors auth.users.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const contributors = new Hono<{ Variables: AuthVariables }>()

contributors.get('/me', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', c.get('userId'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

// Whitelist of client-editable columns. role and email are frozen by the
// profiles_freeze_identity trigger (009) and are ignored here rather than
// rejected, matching PUT /api/child-profile's handling of parent_id.
const EDITABLE = ['name'] as const

contributors.patch('/me', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) patch[key] = (body as Record<string, unknown>)[key]
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', c.get('userId'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

contributors.post('/me/tutorials/:tutorialId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorial_contributors')
    .insert({ tutorial_id: c.req.param('tutorialId'), profile_id: c.get('userId') })
  // WHY: If the tutorial submit fails midway, the user retries and this endpoint
  //      is called again with the same tutorial, causing a duplicate link error.
  // HOW: A duplicate key error means the link already exists — return success so
  //      the rest of the submit can continue.
  if (error) {
    // 23505 = unique_violation: already linked (retry-safe)
    if (error.code === '23505') return c.body(null, 200)
    return c.json({ error: error.message }, 500)
  }
  return c.body(null, 201)
})

export default contributors
