/**
 * Public (Unauthenticated) Routes
 * 
 * These endpoints allow anyone to browse approved tutorials WITHOUT authentication.
 * They do NOT go through authMiddleware (see: src/index.ts line 20).
 * 
 * Endpoints:
 * - GET /api/public/tutorials
 *   - Query approved tutorials, optionally filter by difficulty
 *   - Returns: array of Tutorial objects
 * 
 * - GET /api/public/tutorials/:id
 *   - Get full tutorial details with parts, tools, 3D files, and contributors
 *   - Only returns tutorials with status='approved'
 *   - Returns: TutorialWithDetails object
 * 
 * Security:
 * - Uses admin client (no RLS) because no user context
 * - Only returns tutorials with status='approved'
 * - Cannot create/modify/delete from this endpoint
 * 
 * Related files:
 * - routes/tutorials.ts: Protected endpoints for CRUD operations
 * - middleware/auth.ts: Not used here (public routes)
 */
import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'

const publicRoutes = new Hono()

publicRoutes.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const difficulty = c.req.query('difficulty')
  let query = supabase
    .from('tutorials')
    // Backing rides along with the list so a library card can name its backers.
    // The alternative is a request per card on the busiest page on the site.
    .select('*, tutorial_orgs(status, organizations(id, name))')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  // Filtered here rather than in the select, for the same reason the detail route
  // does it: PostgREST cannot constrain an embedded relation from the parent query,
  // and this route uses the admin client, so the public RLS badge policy is not
  // doing it for us. A declined organisation must never look like it endorsed
  // anything.
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { tutorial_orgs?: Array<{ status: string }> }
  >
  return c.json(
    rows.map((t) => ({
      ...t,
      tutorial_orgs: (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
    }))
  )
})

publicRoutes.get('/tutorials/:id', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    // Backing and the approver are part of what a parent is deciding on, so they
    // come down with the tutorial rather than needing a second, authenticated call
    // — this endpoint serves logged-out visitors.
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(role, profiles(name)), ' +
        'tutorial_orgs(status, organizations(id, name)), ' +
        'reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .single()
  if (error) return c.json({ error: error.message }, 404)
  // Filter the embed here rather than in the select: PostgREST cannot constrain an
  // embedded relation's rows from the parent query, and an organisation's mark must
  // never appear on a request it did not accept. This route uses the admin client,
  // so the public RLS badge policy is not doing it for us.
  const tutorial = data as unknown as Record<string, unknown> & {
    tutorial_orgs?: Array<{ status: string }>
  }
  return c.json({
    ...tutorial,
    tutorial_orgs: (tutorial.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
  })
})

export default publicRoutes
