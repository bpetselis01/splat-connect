import type { Metadata } from 'next'
import { Nunito, IBM_Plex_Mono, Jersey_10 } from 'next/font/google'
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

// Nunito is the mobile app's family (packages/mobile/lib/theme.ts). One rounded
// sans across headings, labels, buttons and data — product UI doesn't need a
// display/body pairing, and the shared family is what makes the two surfaces
// read as one product.
// 900 and italic 700 are the Pixel additions. The heading register runs on
// Nunito's heaviest weight rather than on a second display family: a black
// rounded sans at 3.9rem is already a different voice from the same face at
// 16px, and keeping one family is what holds the mobile-app parity argument.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-nunito',
  display: 'swap',
})

// The second family, and it is deliberately not a display face. Mono is used
// only for micro-labels — eyebrows, breadcrumbs, photo-slot captions, the
// "142 guides" meta line on a tile. Those are the parts of the page that are
// machinery rather than voice, and setting them in a monospace at 10-11px with
// wide tracking is what stops them competing with the headline they sit under.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  // Not `--font-mono`: that is the Tailwind theme key below, and a token that
  // resolves to itself resolves to nothing.
  variable: '--font-plex-mono',
  display: 'swap',
})

// The pixel system's one display face — headings only, never body text. Full
// Pixel pages use it; Quiet Pixel pages (see the spec's register table) fall
// back to Nunito instead, so this variable is opt-in per page class rather
// than global.
const jersey = Jersey_10({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jersey',
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
      <html lang="en" className={`${nunito.variable} ${plexMono.variable} ${jersey.variable}`}>
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
    <html lang="en" className={`${nunito.variable} ${plexMono.variable} ${jersey.variable}`}>
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
                    shell. A signed-out visitor on an account-shaped route
                    like /notifications still gets Nav here (shell is null
                    because AppShell returned null with no session, not
                    because nestsRail said no) — they need a way to sign in. */}
                <Nav caps={caps} quiet={account} />
                <div className="relative overflow-hidden">
                  <PixelBackdrop tone={tone} />
                  <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
                    {/* /notifications resolves to the account section even
                        signed out, and a "← My SPLAT" link back to a page you
                        can't reach is worse than no breadcrumb — Nav above
                        stays visible either way, since a signed-out visitor
                        still needs a way to sign in. */}
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
