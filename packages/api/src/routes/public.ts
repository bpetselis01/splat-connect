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
 *   - Get full tutorial details with parts, tools, and 3D files
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
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

publicRoutes.get('/tutorials/:id', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*)')
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default publicRoutes
