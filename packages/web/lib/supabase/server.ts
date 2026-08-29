/**
 * Cookie-session Supabase client for server components and route handlers.
 *
 * Extracted from lib/auth.ts when the /files route handler became the second
 * caller. The setAll try/catch is load-bearing: a Server Component cannot set
 * cookies, and the middleware owns the refresh.
 *
 * Related files:
 * - lib/auth.ts: getUserRole, the first caller
 * - app/files/[bucket]/[...path]/route.ts: signs storage URLs with this
 */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component cannot set cookies — middleware handles refresh
          }
        },
      },
    }
  )
}
