import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { getUserRole } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import { SectionNav } from '@/components/section-nav'
import { PublicFooter } from '@/components/public-footer'

// Nunito is the mobile app's family (packages/mobile/lib/theme.ts). One rounded
// sans across headings, labels, buttons and data — product UI doesn't need a
// display/body pairing, and the shared family is what makes the two surfaces
// read as one product.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-nunito',
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

  const shell = bare ? null : await AppShell({ children })

  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased">
        {shell ?? (
          <>
            {/* WCAG 2.4.1: up to ~19 tab stops (logo, six section links, role
                links, sign-in, plus a section subnav of up to nine) sit ahead of
                content on every public route, so it needs a bypass. A fragment
                link to a focusable target is the platform's own mechanism —
                browsers move focus to the target, not just the scroll position,
                as long as it can hold focus (hence tabIndex={-1} on <main>
                below). No JS, no focus() call. */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand"
            >
              Skip to main content
            </a>
            <Nav role={await getUserRole()} />
            {!bare && <SectionNav pathname={pathname} />}
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
            >
              {children}
            </main>
            {!bare && <PublicFooter />}
          </>
        )}
      </body>
    </html>
  )
}
