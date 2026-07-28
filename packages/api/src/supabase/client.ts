/**
 * Service-role Supabase client — BYPASSES RLS. Only for operations where that
 * is intentional (auth validation in middleware, admin routes, public reads
 * with no user context). For user-facing data access use createUserClient()
 * so RLS stays the authorization boundary.
 */
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
