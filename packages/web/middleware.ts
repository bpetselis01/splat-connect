import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { authUrl } from '@/lib/safe-next-path'


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
  // The query is what a signed-out redirect must not lose; x-pathname stays pathname-only for the layout.
  headers.set('x-pathname-search', request.nextUrl.pathname + request.nextUrl.search)
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

  const { pathname, search } = request.nextUrl

  // /notifications belongs here for the same reason /dashboard does: it is an
  // account page, it renders the rail, and both of its fetches swallow failure
  // — so without it a signed-out visitor landed on an empty "Notifications"
  // heading rather than being asked to sign in.
  const signedInRoutes = ['/upload', '/dashboard', '/notifications']
  const adminRoutes = ['/admin']

  const needsSignedInAuth = signedInRoutes.some((r) =>
    pathname.startsWith(r)
  )
  const needsAdminAuth = adminRoutes.some((r) => pathname.startsWith(r))

  if ((needsSignedInAuth || needsAdminAuth) && !user) {
    return NextResponse.redirect(new URL(authUrl('login', pathname + search), request.url))
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
  const termsGatedPrefixes = ['/dashboard', '/upload']
  const needsTerms =
    user &&
    (termsGatedPrefixes.some((r) => pathname.startsWith(r)) ||
      // Pattern, not prefix: /tutorials/[id] is the public detail page.
      /^\/tutorials\/[^/]+\/edit(\/|$)/.test(pathname) ||
      // The organisation directory and profiles are public; the message form is member-only.
      /^\/organizations\/[^/]+\/message(\/|$)/.test(pathname))

  if (needsTerms) {
    const { data: agreements, error } = await supabase
      .from('user_agreements')
      .select('id')
      .eq('user_id', user.id)
      .eq('agreement_type', 'contributor_terms')
      .eq('version', AGREEMENT_VERSIONS.contributor_terms)
      .limit(1)

    // Fail closed: an unreadable acceptance blocks, with a retry message on the terms page.
    if (error || !agreements?.length) {
      if (error) console.error('[middleware] contributor_terms lookup failed:', error.message)
      const url = new URL('/onboarding/contributor-terms', request.url)
      url.searchParams.set('next', pathname + search)
      if (error) url.searchParams.set('retry', '1')
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
