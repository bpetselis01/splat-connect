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

// No session handling server-side: every request carries its own credentials.
const RLS_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

/**
 * Anon-key client — RLS enforced, no user session. For public routes: with no
 * JWT, auth.uid() is NULL, so a table's "published or owner_id = auth.uid()"
 * policy collapses to "published" — the database backs up the route's own
 * filter instead of only the admin client's manual one.
 */
export function createAnonClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, RLS_OPTIONS)
}

/**
 * RLS-respecting Supabase client: the anon client plus the caller's JWT, so
 * Postgres policies see auth.uid() and enforce row access. The Authorization
 * header replaces the anon-key bearer supabase-js would otherwise send.
 */
export function createUserClient(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    ...RLS_OPTIONS,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
