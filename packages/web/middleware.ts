/**
 * Next.js Middleware for Route Protection
 *
 * This middleware runs on EVERY request to the web app (before page rendering).
 * It validates that users have the right authentication status for their route.
 *
 * Why it's needed:
 * - Some routes require only a signed-in account (e.g., /upload, /dashboard)
 * - Some routes are only for admins (e.g., /admin)
 * - This middleware redirects unauthenticated users to /login
 * - This middleware redirects non-admins away from /admin
 *
 * Protected routes:
 * - /upload: signed in
 * - /my-tutorials: signed in
 * - /dashboard: signed in
 * - /admin: Admins only (role='admin')
 * - /organizations: Signed in only — leadership is per-organisation data, not a
 *   role, so there is nothing here for middleware to read. The organisation page
 *   checks it via lib/org-access.ts and shows or hides the workspace accordingly.
 *
 * Note: This is CLIENT-SIDE route protection (UX).
 * Server-side protection is done in:
 * - API middleware (packages/api/src/middleware/auth.ts)
 * - Supabase RLS policies (supabase/migrations/001_initial.sql)
 *
 * Related files:
 * - lib/api-client.ts: Fetches data from API (also validates auth server-side)
 * - app/login: Authentication page
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const signedInRoutes = ['/upload', '/my-tutorials', '/dashboard', '/organizations']
  const adminRoutes = ['/admin']

  const needsSignedInAuth = signedInRoutes.some((r) =>
    pathname.startsWith(r)
  )
  const needsAdminAuth = adminRoutes.some((r) => pathname.startsWith(r))

  if ((needsSignedInAuth || needsAdminAuth) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (needsAdminAuth && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  // WHY: With only 4 routes listed, the auth session cookie wasn't refreshed on
  //      other pages (e.g. the home page), so users could be silently logged out.
  // HOW: This pattern runs the middleware on every page except static assets,
  //      keeping the session cookie fresh across the whole app.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
