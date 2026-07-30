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
 * - /dashboard: signed in
 * - /admin: Admins only (role='admin')
 * - /organizations: Signed in only — leadership is per-organisation data, not a
 *   role, so there is nothing here for middleware to read. The organisation page
 *   checks it via lib/org-access.ts and shows or hides the workspace accordingly.
 * - Contributor terms: /dashboard, /upload, /organizations and
 *   /tutorials/<id>/edit redirect to /onboarding/contributor-terms until the account
 *   has accepted. /admin is excluded — the terms govern submitting, not reviewing.
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

/**
 * The root layout decides whether to render the app shell, and a server layout
 * cannot read the pathname. Publishing it as a *request* header is the smallest
 * way to give it one — no route-group reshuffle of every page.
 *
 * Set on the request rather than on the response. Next's documented channel for
 * middleware -> server-component headers is the x-middleware-override-headers
 * protocol, which NextResponse.next({ request: { headers } }) populates at
 * construction time; setting it on the response instead happens to also reach
 * headers() on Next 16.2.6, but that is incidental and it additionally emits the
 * app's internal routing state to the browser on every response. Hence: request
 * headers, at every construction site.
 *
 * The Headers copy is rebuilt per call rather than snapshotted once: setAll()
 * refreshes the session via request.cookies.set(), which mutates the request's
 * cookie header, and a stale snapshot would drop the refreshed session cookie
 * on its way back into the request — silently logging users out.
 */
function nextWithPathname(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = nextWithPathname(request)

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
          supabaseResponse = nextWithPathname(request)
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

  const signedInRoutes = ['/upload', '/dashboard', '/organizations']
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

  // Contributor terms gate. Only the account area — public browsing, /legal and the
  // auth pages stay reachable, and /admin is excluded because these terms govern
  // submitting work, not reviewing it.
  const termsGatedPrefixes = ['/dashboard', '/upload', '/organizations']
  const needsTerms =
    user &&
    (termsGatedPrefixes.some((r) => pathname.startsWith(r)) ||
      // Pattern, not prefix: /tutorials/[id] is the public detail page.
      /^\/tutorials\/[^/]+\/edit(\/|$)/.test(pathname))

  if (needsTerms) {
    const { data: agreements, error } = await supabase
      .from('user_agreements')
      .select('id')
      .eq('user_id', user.id)
      .eq('agreement_type', 'contributor_terms')
      .limit(1)

    // Err open on failure. This gate is UX; packages/api/src/routes/tutorials.ts:132
    // is the real enforcement, so a transient read error must not strand anyone.
    if (error) {
      console.error('[middleware] contributor_terms lookup failed:', error.message)
    } else if (!agreements?.length) {
      const url = new URL('/onboarding/contributor-terms', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  // x-pathname rides on the request headers instead — see nextWithPathname().
  return supabaseResponse
}

export const config = {
  // WHY: With only 4 routes listed, the auth session cookie wasn't refreshed on
  //      other pages (e.g. the home page), so users could be silently logged out.
  // HOW: This pattern runs the middleware on every page except static assets,
  //      keeping the session cookie fresh across the whole app.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
