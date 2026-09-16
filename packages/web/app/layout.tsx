import type { Metadata } from 'next'
import { Nunito, JetBrains_Mono, Baloo_2 } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { DrawerProvider } from '@/components/drawer-context'
import { getCapabilities } from '@/lib/capabilities'
import { AppShell } from '@/components/app-shell'
import { PublicFooter } from '@/components/public-footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { PixelBackdrop } from '@/components/pixel-backdrop'
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'
import { sectionFor, ACCOUNT_NAV, nestsRail } from '@/lib/public-nav'

// Nunito carries UI text, labels, buttons and card titles. It is still the
// mobile app's family (packages/mobile/lib/theme.ts), which is what keeps the
// two surfaces reading as one product.
//
// Pixel ran headings on Nunito 900 because it had no display face worth the
// second download. Soft Pop does, so the heaviest weights move to Baloo 2 below
// and Nunito goes back to being body and UI. The artboard loads 400-800.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-nunito',
  display: 'swap',
})

// Numerics, and the micro-labels that are machinery rather than voice —
// eyebrows, breadcrumbs, the "142 guides" meta line on a tile. Soft Pop sets
// counts and money in mono with tabular-nums so columns of figures line up;
// that is the job Jersey 10 held under Pixel, done by a face that can also set
// a lowercase label.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  // Not `--font-mono`: that is the Tailwind theme key, and a token that
  // resolves to itself resolves to nothing.
  variable: '--font-jetbrains',
  display: 'swap',
})

// Every heading, at 800. Unlike Jersey 10 — which was numerals-only and opted
// in per page class — this is a real display face and applies globally through
// --font-display.
const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-baloo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SPLAT Connect — Toy Adaptation Library',
  description:
    'Open-source tutorials for switch-adapting toys for children with disabilities',
}

/** Routes that must never show the shell. A rail on the contributor-terms
    gate is an escape hatch out of a gate — every link bounces straight back. */
const BARE_PREFIXES = ['/login', '/signup', '/auth', '/onboarding']

/** Exported for tests: the layout is async and reads headers(), so the rule is
    verified here rather than by rendering the whole tree. */
export function isBare(pathname: string): boolean {
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Exported for tests, exactly as isBare is: whether this route is inside the
    account section, and therefore takes the header's quiet variant. Does NOT
    mean the rail renders — /dashboard is in the account section but keeps the
    header instead of the rail; see lib/public-nav.ts's nestsRail for that. */
export function isAccountRoute(pathname: string): boolean {
  return !isBare(pathname) && sectionFor(pathname) === ACCOUNT_NAV
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headerList = await headers()
  const pathname = headerList.get('x-pathname') ?? ''
  const bare = isBare(pathname)
  const account = isAccountRoute(pathname)
  // The whole public surface gets its section's shapes behind it. Doing this in
  // the layout rather than per page is why it costs nothing to add a page.
  const tone = sectionFor(pathname)?.tone ?? 'brand'

  if (bare) {
    // Same scaffolding as the non-bare branch below, minus the three pieces
    // that are always conditional on !bare there too: Nav, PixelBackdrop
    // and PublicFooter. A gate page (/login, /signup, /auth/confirmed,
    // /onboarding/contributor-terms) still needs the .pixel ancestor its
    // buttons are styled under, the skip link (WCAG 2.4.1), and a <main>
    // landmark — losing all three was a real regression from before this
    // branch, caught in the final review round.
    return (
      <html lang="en" className={`${nunito.variable} ${jetbrainsMono.variable} ${baloo.variable}`}>
        <body className="min-h-screen font-sans antialiased">
          <div className="pixel">
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand"
            >
              Skip to main content
            </a>
            <DrawerProvider>
              <div className="relative overflow-hidden">
                <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
                  <Breadcrumb />
                  {children}
                </main>
              </div>
            </DrawerProvider>
          </div>
        </body>
      </html>
    )
  }

  // The page region: inside the account section the rail wraps it; everywhere
  // else it is the backdrop plus main. AppShell returns null for a signed-out
  // visitor, so an account URL reached without a session still renders
  // (the page itself redirects to /login).
  //
  // The footer is threaded in here rather than rendered as a fixed sibling
  // below, because .shell-rail (app/globals.css) is a fixed sidebar: a
  // footer rendered outside .shell-main sits at the container's full width,
  // and its leftmost column ends up under the rail. Passing it through
  // AppShell -> ShellFrame renders it inside .shell-main, where it inherits
  // the same margin-inline-start offset that already keeps <main> clear of
  // the rail.
  const caps = await getCapabilities()
  // /dashboard ("My SPLAT") is the one account page that keeps the header
  // instead of the rail — see nestsRail's docstring in lib/public-nav.ts.
  const shell = nestsRail(pathname) ? await AppShell({ children, footer: <PublicFooter /> }) : null

  return (
    <html lang="en" className={`${nunito.variable} ${jetbrainsMono.variable} ${baloo.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="pixel">
          {/* WCAG 2.4.1 — one skip link for the whole app, since there is now
              exactly one path to <main>. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand"
          >
            Skip to main content
          </a>
          <DrawerProvider>
            {shell ?? (
              <>
                {/* Nav only renders when there is no shell: the header and
                    the rail are mutually exclusive by construction, never
                    both on screen together (components/rail.tsx carries its
                    own "Back to My SPLAT" link for pages that have the rail
                    instead). quiet tracks account-section membership
                    (isAccountRoute), not shell presence — the header renders
                    quiet on /dashboard too, even though /dashboard has no
                    shell. The signed-out-inside-the-account-section case
                    this branch also covers is defence in depth now rather
                    than a live path: every account route redirects a visitor
                    with no session, /notifications included since it joined
                    middleware.ts's signedInRoutes. */}
                <Nav caps={caps} quiet={account} />
                <div className="relative overflow-hidden">
                  <PixelBackdrop tone={tone} />
                  <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
                    {/* A "← My SPLAT" link back to a page you cannot reach is
                        worse than no breadcrumb. /notifications was the route
                        that reached this signed out; it redirects now, so this
                        holds the line for any account route added later
                        without a guard of its own. */}
                    {!(account && shell === null) && <Breadcrumb />}
                    {children}
                  </main>
                </div>
              </>
            )}
          </DrawerProvider>
          {/* Signed-out visitor on any non-bare route, account or public: no
              shell rendered, so the footer has no rail to clear and belongs
              at the outer level as before. When shell exists, it already
              carries its own footer (see the comment above). */}
          {!shell && <PublicFooter />}
          <BackToMySplatDock signedIn={!!caps} />
        </div>
      </body>
    </html>
  )
}
