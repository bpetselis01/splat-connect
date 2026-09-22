/**
 * Contributor profile routes: GET/PATCH /api/contributors/me.
 *
 * `name`, the pickup_* address fields, `public_showcase`, `bio` and
 * `featured_tutorial_id` are mutable
 * (see EDITABLE below).
 * `role` and `email` are frozen by the profiles_freeze_identity trigger
 * (009) — role was an escalation path, and email mirrors auth.users.
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { pickEditable } from './pick-editable.js'
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
const EDITABLE = [
  'name', 'pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode', 'public_showcase',
  // 072: the public profile's About paragraph and featured guide.
  'bio', 'featured_tutorial_id',
] as const

contributors.patch('/me', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  // public_showcase is `boolean not null` — reject a bad type here rather
  // than let the update 500 at the database.
  if ('public_showcase' in body && typeof (body as Record<string, unknown>).public_showcase !== 'boolean') {
    return c.json({ error: 'public_showcase must be a boolean' }, 400)
  }

  const patch = pickEditable(body as Record<string, unknown>, EDITABLE)

  // 072. The bio bound mirrors the check constraint so a long paragraph is a
  // 400 with words rather than a 500. The featured guide has to be one the
  // caller is credited on AND approved: a draft or somebody else's guide on a
  // public profile would be a leak of the one and a lie about the other.
  if (typeof patch.bio === 'string' && patch.bio.length > 600) {
    return c.json({ error: 'bio must be 600 characters or fewer' }, 400)
  }
  if ('bio' in patch && patch.bio !== null && typeof patch.bio !== 'string') {
    return c.json({ error: 'bio must be a string' }, 400)
  }
  if (typeof patch.featured_tutorial_id === 'string') {
    const { data: own } = await createUserClient(c.get('token'))
      .from('tutorial_contributors')
      .select('tutorial_id, tutorials!inner(status)')
      .eq('profile_id', c.get('userId'))
      .eq('tutorial_id', patch.featured_tutorial_id)
      .eq('tutorials.status', 'approved')
      .maybeSingle()
    if (!own) return c.json({ error: 'featured_tutorial_id must be one of your published guides' }, 400)
  } else if ('featured_tutorial_id' in patch && patch.featured_tutorial_id !== null) {
    return c.json({ error: 'featured_tutorial_id must be a uuid or null' }, 400)
  }

  // Admin client: pickup_* columns are revoked from `authenticated` at the
  // grant level (028), so RETURNING those columns via a user-scoped client
  // would fail even though the UPDATE itself is RLS-permitted.
  const supabase = createAdminClient()
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
