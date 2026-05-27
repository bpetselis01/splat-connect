/**
 * JWT Authentication Middleware
 * 
 * This middleware is applied to ALL protected routes (/api/tutorials, /api/admin, etc.).
 * It handles the critical security step of validating JWT tokens.
 * 
 * Process:
 * 1. Extracts JWT from Authorization header (Bearer <token>)
 * 2. Validates JWT using Supabase auth service (verifies signature, expiry)
 * 3. Retrieves user profile from database (checks role, approval status)
 * 4. Attaches userId, role, approved, and token to Hono context
 * 5. If any step fails, returns 401 (unauthorized) or 403 (forbidden)
 * 
 * Context variables added to request:
 * - userId: unique identifier of authenticated user
 * - role: 'admin' | 'contributor'
 * - approved: boolean indicating if user has been approved
 * - token: the JWT itself (used to create RLS-respecting Supabase client)
 * 
 * Related files:
 * - supabase/user-client.ts: Uses the token to create RLS-respecting clients
 * - routes/*.ts: Each route handler has access to these context variables
 */
import type { MiddlewareHandler } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import type { Role } from '@splat-connect/types'

export type AuthVariables = {
  userId: string
  role: Role
  approved: boolean
  token: string
}

export const authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  c,
  next
) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)
  const supabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, approved')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return c.json({ error: 'User profile not found' }, 403)
  }

  c.set('userId', user.id)
  c.set('role', profile.role as Role)
  c.set('approved', profile.approved as boolean)
  c.set('token', token)

  await next()
}
