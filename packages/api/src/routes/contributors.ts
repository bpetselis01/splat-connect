/**
 * Contributor Profile Routes (Protected)
 * 
 * Handles viewing and updating contributor profile information.
 * 
 * Endpoints:
 * - GET /api/contributors/me
 *   - Get current user's profile
 *   - Returns: Profile object { id, name, email, role, approved, created_at }
 * 
 * - PATCH /api/contributors/me
 *   - Update current user's profile
 *   - Body: { name?, email? } (currently only name/email are mutable)
 *   - Returns: updated Profile object
 * 
 * Profile data:
 * - id: User ID from Supabase auth
 * - name: Display name
 * - email: Contact email
 * - role: 'admin' | 'contributor'
 * - approved: Boolean flag set by admin
 * - created_at: When account was created
 * 
 * Approval workflow:
 * 1. New user signs up
 * 2. Their profile is created with approved=false
 * 3. They see /pending page ("Awaiting approval")
 * 4. Admin approves them (updates approved=true)
 * 5. User redirected to /dashboard
 * 6. User can now create tutorials
 * 
 * Related files:
 * - middleware/auth.ts: Validates JWT + extracts userId
 * - app/pending: Page shown while awaiting approval
 * - app/dashboard: Contributor hub (after approval)
 * - types/index.ts: Profile type definition
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
