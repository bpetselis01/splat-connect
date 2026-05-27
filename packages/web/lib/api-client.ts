/**
 * Server-Side API Client
 * 
 * This is the ONLY place in the web app where HTTP requests to the API are made.
 * It's marked 'server-only' because it needs to access Supabase session cookies,
 * which should never be exposed to the browser.
 * 
 * Process:
 * 1. Reads user's session JWT from Supabase auth cookies
 * 2. Makes fetch request to API_URL with Authorization header
 * 3. Passes JWT so API can validate user + enforce RLS
 * 4. Returns typed response
 * 
 * Two main functions:
 * - request(): For JSON requests (GET, POST, PATCH, DELETE)
 * - requestFormData(): For file uploads (multipart/form-data)
 * 
 * Authentication flow:
 * Web middleware (middleware.ts) validates session exists
 *   ↓
 * Page/component calls api-client function
 *   ↓
 * api-client reads JWT from cookies
 *   ↓
 * api-client sends JWT to API
 *   ↓
 * API middleware (packages/api/src/middleware/auth.ts) validates JWT
 *   ↓
 * API route handler runs with validated userId, role, approved
 *   ↓
 * Supabase RLS policies enforce row-level access control
 *   ↓
 * Response returned to web
 * 
 * Security:
 * - Marked 'server-only' so never accidentally used in browser
 * - JWT is sent via Authorization header (never exposed in URL)
 * - API server validates all JWTs before processing requests
 * - Supabase RLS adds another layer of access control
 * 
 * Related files:
 * - middleware.ts: Validates session exists before rendering pages
 * - packages/api/src/middleware/auth.ts: Server-side JWT validation
 * - lib/browser-api-client.ts: Browser-safe client (different approach)
 */
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

async function getToken(): Promise<string | null> {
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
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  get:          <T>(path: string)                     => request<T>('GET',    path),
  post:         <T>(path: string, body: unknown)       => request<T>('POST',   path, body),
  patch:        <T>(path: string, body: unknown)       => request<T>('PATCH',  path, body),
  delete:       <T>(path: string)                     => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
}
