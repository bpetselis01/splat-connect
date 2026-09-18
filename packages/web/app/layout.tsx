import type { Metadata } from 'next'
import { Nunito, JetBrains_Mono, Baloo_2 } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { getCapabilities } from '@/lib/capabilities'
import { PublicFooter } from '@/components/public-footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { PixelBackdrop } from '@/components/pixel-backdrop'
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'
import { sectionFor, ACCOUNT_NAV } from '@/lib/public-nav'

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
  // 700 as well: design-system-update/tokens/typography.css imports
  // JetBrains Mono at 400;500;700, and the system asks for the bold — Chip's
  // stat figure and CostPanel's line amounts are both 700. Without it the
  // browser synthesises one, which is the same fault the headings had when
  // --font-display asked Baloo 2 for a 900 it does not ship.
  weight: ['400', '500', '700'],
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
    account section, and therefore takes the header's quiet variant. */
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
            <div className="relative overflow-x-clip">
              <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
                <Breadcrumb />
                {children}
              </main>
            </div>
          </div>
        </body>
      </html>
    )
  }

  // One page region for every non-bare route, account or public: header,
  // backdrop, main, footer. The account section used to swap the header for a
  // fixed rail; the artboard's hub note — "replaces the old sidebar entirely"
  // — retired it on 2026-09-17, so there is no second arrangement left to
  // choose between and the footer goes back to being an ordinary sibling.
  const caps = await getCapabilities()

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
          {/* quiet tracks account-section membership (isAccountRoute): the
              header renders in its quiet register across My SPLAT and every
              page under it. */}
          <Nav caps={caps} quiet={account} />
          <div className="relative overflow-x-clip">
            <PixelBackdrop tone={tone} />
            <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
              {/* A "← My SPLAT" link back to a page you cannot reach is worse
                  than no breadcrumb. Every account route redirects a visitor
                  with no session, so this is defence in depth for any account
                  route added later without a guard of its own. */}
              {!(account && !caps) && <Breadcrumb />}
              {children}
            </main>
          </div>
          <PublicFooter />
          <BackToMySplatDock signedIn={!!caps} />
        </div>
      </body>
    </html>
  )
}
