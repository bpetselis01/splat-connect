/**
 * Server-side API client — the only place server code makes HTTP requests to
 * the API. 'server-only' because the token comes from the Supabase auth
 * cookies, which must never reach the browser. The API validates the JWT and
 * Supabase RLS enforces row access; the browser counterpart is
 * lib/browser-api-client.ts.
 */
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { makeApiClient } from './api-core'

// cache(): a single page render calls apiClient 4-5x (profile, tutorial,
// backing, orgs); without this, each call re-verifies the session against
// Supabase, stacking redundant round-trips into every page load.
const getToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
})

// no-store: server components must not serve one user's API response to another.
export const apiClient = makeApiClient({
  getToken,
  baseUrl: () => process.env.API_URL as string,
  cache: 'no-store',
})
