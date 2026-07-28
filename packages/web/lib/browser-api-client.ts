/**
 * Browser-side API client for 'use client' components. Same request core as
 * the server client (lib/api-client.ts); the token comes from the Supabase
 * browser session instead of cookies, and the API still validates the JWT
 * server-side.
 */
'use client'

import { createClient } from '@/lib/supabase/client'
import { makeApiClient } from './api-core'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export const browserApiClient = makeApiClient({
  getToken,
  baseUrl: () => process.env.NEXT_PUBLIC_API_URL as string,
})
