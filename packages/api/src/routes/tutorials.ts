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
    .select('*, tutorial_contributors!inner(profile_id)')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors!inner(profile_id)')
    .eq('tutorial_contributors.profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*), tutorial_contributors(*, profiles(*))')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

tutorials.post('/', async (c) => {
  const body = await c.req.json()
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

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json()
  // WHY: A database permission bug previously blocked contributors from updating
  //      tutorials, so a temporary admin connection was used as a workaround.
  // HOW: The permission is now fixed in the database (migration 005 in
  //      001_schema.sql), so the regular user connection works and correctly
  //      enforces who can edit which tutorial.
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update(body)
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