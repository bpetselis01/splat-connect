/**
 * Tutorial CRUD Routes (Protected)
 * 
 * These endpoints handle creating, reading, updating, and deleting tutorials.
 * All routes require JWT authentication via authMiddleware.
 * 
 * Endpoints:
 * - GET /api/tutorials
 *   - Get all tutorials (user can see their own + approved ones)
 *   - RLS policy: tutorial_contributors.profile_id = current_user_id
 *   - Returns: array of Tutorial objects
 * 
 * - GET /api/tutorials/mine
 *   - Get only tutorials created by current user
 *   - Returns: array of Tutorial objects (all statuses)
 * 
 * - GET /api/tutorials/:id
 *   - Get full tutorial with parts, tools, 3D files, and all contributors
 *   - RLS ensures user can only see tutorials they own or that are approved
 *   - Returns: TutorialWithDetails object
 * 
 * - POST /api/tutorials
 *   - Create new draft tutorial
 *   - Auto-generates status='draft'
 *   - Also creates tutorial_contributors record linking user to tutorial
 *   - Returns: Tutorial object
 * 
 * - PATCH /api/tutorials/:id
 *   - Update tutorial (usually to change status: draft→pending)
 *   - RLS ensures user can only update their own tutorials
 *   - Returns: updated Tutorial object
 * 
 * - DELETE /api/tutorials/:id
 *   - Delete tutorial and all related parts/tools/files
 *   - RLS ensures user can only delete their own tutorials
 *   - Returns: 204 No Content
 * 
 * Security Notes:
 * - createUserClient() creates RLS-respecting Supabase client from JWT
 * - Supabase RLS policies enforce row-level access control
 * - Admin client used only in POST (to bypass JWT context issues with inserts)
 * 
 * Related files:
 * - middleware/auth.ts: Provides userId, role, approved, token
 * - supabase/user-client.ts: Creates RLS-respecting clients
 * - routes/public.ts: Unauthenticated access to approved tutorials only
 * - routes/parts.ts: Add/remove materials from tutorials
 * - routes/tools.ts: Add/remove tools from tutorials
 * - routes/stl-files.ts: Add/remove 3D files from tutorials
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const tutorials = new Hono<{ Variables: AuthVariables }>()

tutorials.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    // tutorial_orgs is embedded for the leader dashboard, which splits its two
    // lists by each row's backing status. The embed is itself RLS-filtered, so a
    // caller only ever sees backing rows for a project they authored or an
    // organisation they lead — the same list serves both without a second call.
    .select('*, tutorial_contributors!inner(profile_id), tutorial_orgs(status, org_id, organizations(id, name))')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    // tutorial_orgs is embedded for the leader dashboard, which splits its two
    // lists by each row's backing status. The embed is itself RLS-filtered, so a
    // caller only ever sees backing rows for a project they authored or an
    // organisation they lead — the same list serves both without a second call.
    .select('*, tutorial_contributors!inner(profile_id), tutorial_orgs(status, org_id, organizations(id, name))')
    .eq('tutorial_contributors.profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    // reviewer/reviewed_for name who approved it and whose authority they used.
    // Same shape the public detail route uses, so there is one way to ask this.
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(*, profiles(*)), ' +
        'reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

tutorials.post('/', async (c) => {
  const body = await c.req.json()
  if (!(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
    return c.json({ error: 'You must accept the contributor terms before contributing' }, 403)
  }
  // WHY: Uses the admin client (bypasses RLS) because RLS policies rely on
  //      auth.uid() from a JWT context that inserts through this route don't have.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .insert({
      id: body.id,
      title: body.title,
      difficulty: body.difficulty,
      description: body.description ?? null,
      status: 'draft',
      tutorial_pdf_url: body.tutorial_pdf_url ?? null,
      toy_photo_url: body.toy_photo_url ?? null,
    })
    .select()
    .single()
  // WHY: If the submit fails and the user retries, the same tutorial ID is sent
  //      again, hitting a duplicate key error on the second insert.
  // HOW: A duplicate key error means the tutorial was already created — return
  //      success so the caller can continue with the remaining submit steps.
  if (error) {
    // 23505 = unique_violation: tutorial already exists (retry-safe)
    if (error.code === '23505') return c.json({ id: body.id }, 200)
    console.error('[POST /api/tutorials] Supabase error:', error.code, error.message)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

/** Only these may be set through the generic edit endpoint. Unknown keys are
 *  dropped silently; the protected ones return 403 so a caller learns rather than
 *  wonders. */
const EDITABLE = ['title', 'description', 'difficulty', 'tutorial_pdf_url', 'toy_photo_url', 'status'] as const
const PROTECTED = ['reviewed_by', 'reviewed_for_org_id', 'reviewed_at', 'rejection_note']

async function hasAcceptedContributorTerms(token: string, userId: string) {
  const { data } = await createUserClient(token)
    .from('user_agreements')
    .select('id')
    .eq('user_id', userId)
    .eq('agreement_type', 'contributor_terms')
    .limit(1)
  return (data ?? []).length > 0
}

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  const attempted = PROTECTED.filter((k) => k in body)
  if (attempted.length) {
    return c.json({ error: `${attempted.join(', ')} cannot be set here` }, 403)
  }

  // WHY status is restricted to draft and pending: a leader holds an UPDATE grant
  // on tutorials, so without this they could publish through this generic
  // endpoint. RLS would permit it, but reviewed_by and reviewed_for_org_id would
  // stay null — a published tutorial with no audit trail, invisible to the admin
  // spot-check. Approving and rejecting must go through POST /:id/review or the
  // admin status endpoint.
  if ('status' in body && body.status !== 'draft' && body.status !== 'pending') {
    return c.json({ error: 'use POST /:id/review to approve or reject' }, 403)
  }

  // The contributor_terms gate. Checked here as well as on create, because gating
  // creation alone would let drafts that predate the terms sail through while
  // blocking their authors from touching them. draft -> pending is the moment work
  // is actually offered to the platform.
  if (body.status === 'pending' && !(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
    return c.json({ error: 'You must accept the contributor terms before submitting' }, 403)
  }

  const update: Record<string, unknown> = {}
  for (const key of EDITABLE) if (key in body) update[key] = body[key]
  if (!Object.keys(update).length) return c.json({ error: 'nothing to update' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update(update)
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorials')
    .delete()
    .eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default tutorials