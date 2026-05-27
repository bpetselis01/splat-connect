/**
 * RLS-Respecting Supabase Client Factory
 * 
 * Creates a Supabase client that enforces Row Level Security (RLS) policies.
 * This is the KEY to security: the client uses the user's JWT, so Supabase's
 * RLS policies know exactly which user is making the request and enforce access control.
 * 
 * How it works:
 * 1. Takes user's JWT token as input
 * 2. Creates Supabase client with anon key (not service role)
 * 3. Overrides the fetch function to inject JWT in Authorization header
 * 4. Every request to Supabase goes through with the user's JWT
 * 5. Supabase RLS policies check: does this user have permission?
 * 
 * Example RLS Policy (supabase/migrations/001_initial.sql):
 * - Tutorial table: users can only see/edit tutorials they created
 * - Profiles table: users can only see their own profile
 * 
 * Critical difference from admin client (supabase/client.ts):
 * - Admin client: Uses service role key, bypasses RLS (used for internal ops only)
 * - User client: Uses anon key + JWT, RLS policies are ENFORCED
 * 
 * Usage in routes:
 * ```typescript
 * const supabase = createUserClient(token)
 * const { data } = await supabase
 *   .from('tutorials')
 *   .select('*')  // RLS filters: only returns tutorials user owns or are approved
 * ```
 * 
 * Related files:
 * - supabase/client.ts: Admin client (no RLS enforcement)
 * - middleware/auth.ts: Extracts token and adds to context
 * - routes/tutorials.ts: Uses user client for all user-facing operations
 */
import { createClient } from '@supabase/supabase-js'

export function createUserClient(token: string) {
  const anonKey = process.env.SUPABASE_ANON_KEY!
  return createClient(
    process.env.SUPABASE_URL!,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (...[input, init]: Parameters<typeof fetch>) => {
          const headers = new Headers(init?.headers)
          headers.set('Authorization', `Bearer ${token}`)
          headers.set('apikey', anonKey)
          const url = typeof input === 'string' ? input : (input as Request).url
          console.log('[user-client] fetch:', url.split('?')[0].slice(-60), '| auth:', headers.get('Authorization')?.slice(0, 30))
          return fetch(input, { ...(init ?? {}), headers })
        },
      },
    }
  )
}
