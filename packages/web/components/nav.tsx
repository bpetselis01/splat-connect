'use client'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/icons'
import { PUBLIC_NAV, sectionFor } from '@/lib/public-nav'
import { toneClass } from '@/lib/tone'
import type { Role } from '@splat-connect/types'

interface NavProps {
  role: Role | null
}

export function Nav({ role }: NavProps) {
  const supabase = createClient()
  // Null outside an App Router context (e.g. the unit tests render Nav directly).
  const pathname = usePathname() ?? ''

  async function signOut() {
    await supabase.auth.signOut()
    // WHY: Same issue as login — router.push() + router.refresh() races mean the nav
    //      can still show the signed-in state after logout until a hard refresh.
    // HOW: Hard reload ensures the server renders the layout without the auth cookie.
    window.location.href = '/'
  }

  // Public sections come from the nav model so the top bar, the subnav and the
  // footer cannot disagree about what the site contains. Role-gated links stay
  // local — they are not part of the public tree. `as const` keeps the
  // role-link hrefs as literals so they satisfy Next's typed routes; the
  // model-driven section hrefs are `string` (see lib/public-nav.ts) and are
  // cast to `Route<string>` at the `<Link>` call site instead.
  const sections = PUBLIC_NAV
  const roleLinks = ([
    { href: '/admin', label: 'Admin', show: role === 'admin' },
    // Any signed-in account, not only role='contributor': since 009 every
    // account may author.
    { href: '/dashboard', label: 'Dashboard', show: role !== null },
  ] as const).filter((l) => l.show)

  const activeSection = sectionFor(pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <nav className="public-shell flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-black tracking-tight text-ink sm:text-xl"
        >
          {/* The mark sits on a plain tinted disc — no ring. The wordmark is the
              only thing in the bar that is not a pill, and it earns that by
              being the heaviest weight on the page rather than by being drawn. */}
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand-tint text-brand-dark"
          >
            <Logo className="h-5 w-5" />
          </span>
          SPLAT Connect
        </Link>

        {/* On narrow screens the links drop to their own row so the logo and the
            account control stay together on the first one. */}
        <div className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:ml-auto sm:w-auto">
          {sections.map((s) => {
            const active = activeSection?.href === s.href
            const tone = toneClass(s.tone)
            return (
              <Link
                key={s.href}
                // Cast: NavSection.href is `string`, not typedRoutes' `Route`, because
                // some of these routes are built in later tasks — see lib/public-nav.ts.
                href={s.href as Route<string>}
                aria-current={active ? 'page' : undefined}
                // No colour on the inactive state: `.nav-pill` already sets
                // brand-deep, and overriding it with `text-muted` was leaving six
                // of the seven pills grey on a white shelf.
                className={`nav-pill flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-extrabold ${
                  active ? `${tone.surface} ${tone.ink}` : ''
                }`}
              >
                {/* The dot is what makes rank legible: the three pillars carry the
                    three distinct accents, the supporting sections stay blue. It is
                    decorative — the label already says which section this is. */}
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${tone.dot} ${
                    active ? '' : 'opacity-60'
                  }`}
                />
                {s.label}
              </Link>
            )
          })}
          {roleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-brand-tint text-brand-deep'
                  : 'text-muted hover:bg-sunken hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {role ? (
          <button
            onClick={signOut}
            className="btn btn-quiet btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0"
          >
            Sign out
          </button>
        ) : (
          <Link
            href="/login"
            className="btn btn-accent btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
