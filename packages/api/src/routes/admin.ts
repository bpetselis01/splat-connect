/**
 * Admin Review Routes (Admin-Only Protected)
 * 
 * These endpoints are ONLY for administrators to review and approve tutorials.
 * They require role='admin' (checked by authMiddleware).
 * 
 * Endpoints:
 * - GET /api/admin/tutorials
 *   - Get all pending tutorials waiting for review
 *   - Query: ?status=pending|approved|rejected (filter by status)
 *   - Auth: Admin only
 *   - Returns: array of Tutorial objects
 * 
 * - PATCH /api/admin/tutorials/:id
 *   - Approve or reject a tutorial
 *   - Body: { status: 'approved'|'rejected', rejection_note?: string }
 *   - Auth: Admin only
 *   - Returns: updated Tutorial object with reviewed_at timestamp
 * 
 * Workflow:
 * 1. Contributor submits tutorial (status→'pending')
 * 2. Admin views /admin page (calls GET /api/admin/tutorials)
 * 3. Admin reviews tutorial content
 * 4. Admin clicks Approve or Reject
 * 5. Web calls PATCH /api/admin/tutorials/:id
 * 6. API updates tutorial status + reviewed_at timestamp
 * 7. If rejected, includes rejection_note explaining why
 * 8. Contributor notified (future feature)
 * 
 * Approval flow:
 * pending → approved: Tutorial appears in public library
 * pending → rejected: Tutorial hidden from view, contributor sees rejection note
 * 
 * Related files:
 * - middleware/auth.ts: Validates role='admin'
 * - routes/tutorials.ts: Tutorial CRUD (this is review layer on top)
 * - app/admin: Admin dashboard page
 * - types/index.ts: Tutorial type (status field)
 */
import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'
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
    .select('*, tutorial_contributors(profile_id)')
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
      reviewed_at: new Date().toISOString(),
      ...(body.rejection_note !== undefined ? { rejection_note: body.rejection_note || null } : {}),
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.get('/contributors', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'contributor')
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.delete('/contributors/:id', async (c) => {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default admin
