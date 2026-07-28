/**
 * JWT middleware for every protected route: validates the bearer token with
 * Supabase auth, loads the profile role, and attaches userId / role / token
 * to context. The token is kept so handlers can build RLS-respecting clients
 * (supabase/user-client.ts).
 */
import type { MiddlewareHandler } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import type { Role } from '@splat-connect/types'

export type AuthVariables = {
  userId: string
  role: Role
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return c.json({ error: 'User profile not found' }, 403)
  }

  c.set('userId', user.id)
  c.set('role', profile.role as Role)
  c.set('token', token)

  await next()
}
