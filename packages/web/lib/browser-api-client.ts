/**
 * Browser-Safe API Client
 * 
 * This is a CLIENT-SIDE API client (marked 'use client').
 * It should only be used in components, NOT in server components or server actions.
 * 
 * Why separate from api-client.ts?
 * - api-client.ts (server-only): Can access secure cookies server-side
 * - browser-api-client.ts (client): Runs in browser, different security model
 * 
 * Process:
 * 1. Component calls getToken() to get JWT from Supabase session
 * 2. Makes fetch to API_URL with JWT in Authorization header
 * 3. Returns typed response
 * 
 * Differences from server api-client:
 * - Runs in browser (token is client-accessible)
 * - Uses Supabase browser client (different config)
 * - No 'server-only' restriction
 * 
 * Security considerations:
 * - Browser client assumes user is authenticated (they opened the page)
 * - JWT is still validated server-side by API
 * - Supabase RLS adds another layer of access control
 * - Should primarily be used in components that are already behind authentication
 * 
 * Related files:
 * - lib/api-client.ts: Server-side version (preferred for data fetching)
 * - middleware.ts: Validates session before rendering pages
 * - lib/supabase/client.ts: Supabase browser client setup
 */
'use client'

import { createClient } from '@/lib/supabase/client'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    // WHY: Error messages from the API were being lost — you'd see "failed with
    //      status 400" but not the reason why.
    // HOW: Reads the response body for an error field and appends it to the
    //      thrown error so the cause is visible in logs and error messages.
    let detail = ''
    try { const j = await res.clone().json() as { error?: string }; if (j.error) detail = `: ${j.error}` } catch {}
    throw new Error(`API ${method} ${path} failed with status ${res.status}${detail}`)
  }
  // WHY: Some API responses have no body (e.g. 204 No Content), which caused
  //      JSON.parse to fail on an empty string and throw an unrelated error.
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    // WHY: Error messages from the API were being lost — you'd see "failed with
    //      status 400" but not the reason why.
    // HOW: Reads the response body for an error field and appends it to the
    //      thrown error so the cause is visible in logs and error messages.
    let detail = ''
    try { const j = await res.clone().json() as { error?: string }; if (j.error) detail = `: ${j.error}` } catch {}
    throw new Error(`API ${method} ${path} failed with status ${res.status}${detail}`)
  }
  // WHY: Some API responses have no body (e.g. 204 No Content), which caused
  //      JSON.parse to fail on an empty string and throw an unrelated error.
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export const browserApiClient = {
  get:          <T>(path: string)                     => request<T>('GET',  path),
  post:         <T>(path: string, body: unknown)       => request<T>('POST', path, body),
  patch:        <T>(path: string, body: unknown)       => request<T>('PATCH', path, body),
  delete:       <T>(path: string)                     => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
}
