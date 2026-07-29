/**
 * Admin-only routes: tutorial review (approve/reject with rejection_note and
 * reviewed_at) and organisation management (creation, suspension, leader
 * appointment).
 */
import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { TutorialStatus } from '@splat-connect/types'

const admin = new Hono<{ Variables: AuthVariables }>()

admin.use('*', async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

admin.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const status = (c.req.query('status') ?? 'pending') as TutorialStatus
  const { data, error } = await supabase
    .from('tutorials')
    // Decision 23: the admin sees every pending tutorial, including ones an
    // organisation has accepted. Delegation removes the obligation to act, not the
    // visibility — so the row carries its backing state and the UI can say
    // "Riverside Therapy accepted, awaiting their review".
    .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/tutorials/:id/status', async (c) => {
  const body = await c.req.json<{ status: TutorialStatus; rejection_note?: string }>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .update({
      status: body.status,
      // reviewed_for_org_id is deliberately left alone: the admin acts for the
      // platform, not for an organisation, and a null there is what distinguishes
      // the two in the spot-check query below.
      reviewed_by: c.get('userId'),
      reviewed_at: new Date().toISOString(),
      ...(body.rejection_note !== undefined ? { rejection_note: body.rejection_note || null } : {}),
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Every non-admin account, not only role='contributor'. Since 009 the role
// column records where an account signed up rather than what it may do, so
// filtering on 'contributor' would hide mobile-registered accounts from the
// screen an admin uses to manage them. The path keeps its name: three call
// sites and an E2E spec reference it.
//
// WHY: with no limit, PostgREST's max_rows (1000, supabase/config.toml) silently
//      truncated this list, and ascending order meant the NEWEST accounts were the
//      ones dropped — so a new signup was invisible to the admin managing accounts,
//      the Accounts count on /admin capped at 1000, and a recent account could not
//      be appointed an org leader.
// HOW:  newest first, an explicit cap so truncation is a decision rather than a
//       platform default, and an exact total so callers stop inferring it from
//       array length.
const ACCOUNT_LIMIT = 1000

admin.get('/contributors', async (c) => {
  const supabase = createAdminClient()
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .neq('role', 'admin')
    .order('created_at', { ascending: false })
    .limit(ACCOUNT_LIMIT)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ accounts: data ?? [], total: count ?? 0 })
})

admin.delete('/contributors/:id', async (c) => {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

/**
 * Organisation authority. All four run under the ADMIN'S OWN JWT via
 * createUserClient, not createAdminClient like the tutorial review handlers
 * above.
 *
 * WHY: so the "Admin can write organizations" and "Admin can write org leaders"
 * policies are the enforcement layer in production, not just in tests. That is
 * decision 9 applied consistently, and it costs nothing here — "Anyone can read
 * organizations" and "Admin can view all profiles" (001_schema.sql:127) cover
 * every read these handlers make.
 *
 * It also avoids a trap that bit the superseded design and was caught only by
 * asserting on the database rather than the status code: triggers run for
 * service_role even though RLS does not, and any guard calling is_admin() reads
 * auth.uid(), which service_role lacks. Such a write raises 42501 while the route
 * reports success having changed nothing. No table here carries such a trigger
 * today — but one added later must not silently break these routes.
 */
async function isContributor(supabase: ReturnType<typeof createUserClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'contributor'
}

admin.post('/organizations', async (c) => {
  const body = await c.req.json<{ name?: string; description?: string; leader_user_id?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  // Required, not optional: an organisation with no leader can answer no request,
  // so a leaderless one is inert and the admin has to come back to fix it. One
  // call creates a working organisation.
  if (!body.leader_user_id) return c.json({ error: 'leader_user_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  if (!(await isContributor(supabase, body.leader_user_id))) {
    // Legacy role gate. Since 009, role records where an account signed up rather
    // than what it may do, so this refuses a mobile-registered account that would
    // otherwise be a valid leader. Kept for now: lifting it changes organisation
    // semantics and the test that pins them, both outside this sub-project.
    // Revisit alongside lib/org-access.ts.
    return c.json({ error: 'an org leader must have the contributor role' }, 400)
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      created_by: c.get('userId'),
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  const { error: leaderError } = await supabase
    .from('org_leaders')
    .insert({ org_id: org.id, user_id: body.leader_user_id })
  if (leaderError) {
    // Roll back rather than leave a leaderless organisation behind: it would be
    // listed in the picker and able to answer nothing.
    await supabase.from('organizations').delete().eq('id', org.id)
    return c.json({ error: leaderError.message }, 500)
  }

  return c.json(org, 201)
})

admin.patch('/organizations/:id', async (c) => {
  const body = await c.req.json<{ status?: string; name?: string; description?: string }>()
  if (body.status !== undefined && body.status !== 'active' && body.status !== 'suspended') {
    return c.json({ error: "status must be 'active' or 'suspended'" }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    .update({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', c.req.param('id'))
    .select()
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'organisation not found' }, 404)
  return c.json(data[0])
})

admin.post('/organizations/:orgId/leaders', async (c) => {
  const body = await c.req.json<{ user_id?: string }>()
  if (!body.user_id) return c.json({ error: 'user_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  if (!(await isContributor(supabase, body.user_id))) {
    return c.json({ error: 'an org leader must have the contributor role' }, 400)
  }

  const { data, error } = await supabase
    .from('org_leaders')
    .insert({ org_id: c.req.param('orgId'), user_id: body.user_id })
    .select()
    .single()
  if (error) {
    // 23505 = already a leader. Idempotent rather than an error: the admin's
    // intent is satisfied either way.
    if (error.code === '23505') return c.json({ ok: true }, 200)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

admin.delete('/organizations/:orgId/leaders/:userId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_leaders')
    .delete()
    .eq('org_id', c.req.param('orgId'))
    .eq('user_id', c.req.param('userId'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'not a leader of that organisation' }, 404)
  return c.body(null, 204)
})

/**
 * GET /api/admin/spot-check
 *
 * A random sample of tutorials someone other than the admin approved. With no
 * self-review block (decision 14) a leader may publish their own work, so
 * sampling is how a bad approval gets noticed at all — this endpoint is the
 * detection half of a control whose other half is reactive.
 */
admin.get('/spot-check', async (c) => {
  const limit = Number(c.req.query('limit') ?? 10)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
    .eq('status', 'approved')
    .not('reviewed_by', 'is', null)
    .neq('reviewed_by', c.get('userId'))
    .limit(limit)
  if (error) return c.json({ error: error.message }, 500)
  // PostgREST has no random ordering, and the sample is small enough that
  // shuffling here costs nothing. Without it an admin only ever re-checks the
  // same newest rows.
  // ponytail: in-memory shuffle of at most `limit` rows; move to a tablesample
  // query if the approved set ever gets large.
  return c.json((data ?? []).sort(() => Math.random() - 0.5))
})

export default admin
