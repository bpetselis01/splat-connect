/**
 * RLS-respecting Supabase client: anon key plus the caller's JWT injected
 * into every request via a fetch override, so Postgres policies see
 * auth.uid() and enforce row access. The admin client (client.ts) is the
 * RLS-bypassing counterpart.
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
