import type { Metadata } from 'next'
import { Nunito, IBM_Plex_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { getUserRole } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import { PublicFooter } from '@/components/public-footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { PlayroomBackdrop } from '@/components/playroom-backdrop'
import { sectionFor } from '@/lib/public-nav'

// Nunito is the mobile app's family (packages/mobile/lib/theme.ts). One rounded
// sans across headings, labels, buttons and data — product UI doesn't need a
// display/body pairing, and the shared family is what makes the two surfaces
// read as one product.
// 900 and italic 700 are the Playroom additions. The heading register runs on
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headerList = await headers()
  const pathname = headerList.get('x-pathname') ?? ''
  const bare = isBare(pathname)
  // The whole public surface gets its section's shapes behind it. Doing this in
  // the layout rather than per page is why it costs nothing to add a page.
  const tone = sectionFor(pathname)?.tone ?? 'brand'

  const shell = bare ? null : await AppShell({ children })

  return (
    <html lang="en" className={`${nunito.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {shell ?? (
          <div className="playroom">
            {/* WCAG 2.4.1: up to ~9 tab stops (logo, six section links, role
                links, sign-in) sit ahead of content on every public route, so it
                needs a bypass. A fragment link to a focusable target is the
                platform's own mechanism — browsers move focus to the target, not
                just the scroll position, as long as it can hold focus (hence
                tabIndex={-1} on <main> below). No JS, no focus() call. */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand"
            >
              Skip to main content
            </a>
            <Nav role={await getUserRole()} />
            <div className="relative overflow-hidden">
              {!bare && <PlayroomBackdrop tone={tone} />}
              <main
                id="main"
                tabIndex={-1}
                className="public-shell relative py-8 sm:py-10"
              >
                <Breadcrumb pathname={pathname} />
                {children}
              </main>
            </div>
            {!bare && <PublicFooter />}
          </div>
        )}
      </body>
    </html>
  )
}
