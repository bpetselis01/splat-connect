'use client'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo, Menu } from '@/components/icons'
import { useDrawer } from '@/components/drawer-context'
import { PUBLIC_NAV, ACCOUNT_NAV, sectionFor, crossesAccountBoundary } from '@/lib/public-nav'
import { toneClass } from '@/lib/tone'
import type { Capabilities } from '@/lib/capabilities'

/** Two letters from a display name, for the avatar. Falls back to one. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/**
 * A pill whose destination crosses the account/public boundary needs a full
 * navigation, not a soft <Link> transition: the root layout (which decides the
 * rail, the backdrop and the quiet header) doesn't re-run on client-side
 * routing, so it can go stale — same reasoning as the hard reload in
 * signOut() below. Non-crossing pills keep the normal <Link>.
 */
function NavLink({
  href,
  crossing,
  className,
  'aria-current': ariaCurrent,
  children,
}: {
  href: string
  crossing: boolean
  className: string
  'aria-current'?: 'page'
  children: React.ReactNode
}) {
  if (crossing) {
    return (
      <a href={href} aria-current={ariaCurrent} className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href as Route<string>} aria-current={ariaCurrent} className={className}>
      {children}
    </Link>
  )
}

interface NavProps {
  /** Null when signed out. Non-null is the whole signed-in test. */
  caps: Capabilities | null
  /** Inside the account section the bar keeps every label and drops its weight.
      Wired in Task 6; accepted here so the layout compiles. */
  quiet?: boolean
  /** Whether the mobile drawer trigger renders. Only true where the drawer
      itself exists — inside the account section. */
  showMenu?: boolean
}

export function Nav({ caps, quiet = false, showMenu = false }: NavProps) {
  const supabase = createClient()
  // Null outside an App Router context (e.g. the unit tests render Nav directly).
  const pathname = usePathname() ?? ''
  const drawer = useDrawer()

  async function signOut() {
    await supabase.auth.signOut()
    // WHY: Same issue as login — router.push() + router.refresh() races mean the nav
    //      can still show the signed-in state after logout until a hard refresh.
    // HOW: Hard reload ensures the server renders the layout without the auth cookie.
    window.location.href = '/'
  }

  // Public sections come from the nav model so the top bar, the subnav and the
  // footer cannot disagree about what the site contains.
  const sections = PUBLIC_NAV

  const activeSection = sectionFor(pathname)

  return (
    <header
      className={`sticky top-0 z-30 border-b border-line ${quiet ? 'nav-quiet' : 'bg-surface'}`}
    >
      <nav className={`public-shell flex flex-wrap items-center gap-x-3 gap-y-2 ${quiet ? 'py-1.5' : 'py-3'}`}>
        {showMenu && (
          <button
            type="button"
            onClick={drawer.open}
            aria-label="Open navigation"
            className="rounded-field p-2 text-ink transition-colors hover:bg-sunken lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
        <NavLink
          href="/"
          crossing={activeSection === ACCOUNT_NAV}
          className="flex shrink-0 items-center gap-2.5 text-lg font-black tracking-tight text-brand-deep sm:text-xl"
        >
          {/* The mark sits on a plain tinted disc — no ring. The wordmark is the
              only thing in the bar that is not a pill, and it earns that by
              being the heaviest weight on the page rather than by being drawn. */}
          <span
            aria-hidden="true"
            className="pixel-avatar grid h-9 w-9 place-items-center bg-brand-tint text-brand-dark"
          >
            <Logo className="h-5 w-5" />
          </span>
          SPLAT Connect
        </NavLink>

        {/* On narrow screens the links drop to their own row so the logo and the
            account control stay together on the first one. On a wide screen
            they run on directly from the wordmark — the account cluster below
            takes the `ml-auto` instead. Pushing the sections right as well left
            nothing between the two groups and forced the whole bar onto a
            second row at 1440px, at which point a 71px shelf was rendering
            105px tall. */}
        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:order-2 sm:w-auto">
          {sections.map((s) => {
            const active = activeSection?.href === s.href
            const tone = toneClass(s.tone)
            return (
              <NavLink
                key={s.href}
                href={s.href}
                crossing={activeSection === ACCOUNT_NAV}
                aria-current={active ? 'page' : undefined}
                // No colour on the inactive state: `.nav-pill` already sets
                // brand-deep, and overriding it with `text-muted` was leaving six
                // of the seven pills grey on a white shelf.
                // No horizontal padding at rest. A pill-shaped hit area was the
                // last piece of the old rounded-pill nav left standing, and
                // seven of them at px-3.5 is ~170px the bar does not have: the
                // row overflowed its shell and wrapped, which is what made the
                // shelf render 116px tall against the board's 71px. The
                // vertical padding stays — it is what keeps every pill a 40px
                // target, well clear of the 24px floor.
                className={`nav-pill flex items-center gap-1.5 whitespace-nowrap py-3 ${
                  active ? `${tone.surface} ${tone.ink} px-3` : ''
                }`}
              >
                {/* The dot is what makes rank legible: the three pillars carry the
                    three distinct accents, the supporting sections stay blue. It is
                    decorative — the label already says which section this is. */}
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${quiet ? 'bg-line' : tone.dot} ${
                    active && !quiet ? '' : 'opacity-60'
                  }`}
                />
                {s.label}
              </NavLink>
            )
          })}
        </div>

        {caps ? (
          // The account cluster, kept together and pushed to the far edge —
          // "My SPLAT", the unread count, the avatar and the way out, in that
          // order. They were three loose flex children each doing their own
          // ordering, which is why sign-out ended up on the pills' row.
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2.5 sm:order-3">
            <NavLink
              href={ACCOUNT_NAV.href}
              // Not `activeSection !== ACCOUNT_NAV`: that missed the split
              // inside the account section itself — from a rail-only page
              // (still ACCOUNT_NAV) to /dashboard (no rail), nestsRail
              // differs, so it is a crossing too. crossesAccountBoundary is
              // the one place that rule lives; see its docstring.
              crossing={crossesAccountBoundary(pathname, ACCOUNT_NAV.href)}
              aria-current={activeSection?.href === ACCOUNT_NAV.href ? 'page' : undefined}
              className={`nav-pill flex items-center gap-1.5 whitespace-nowrap py-3 ${
                activeSection?.href === ACCOUNT_NAV.href ? 'bg-brand-tint text-brand-deep px-3' : ''
              }`}
            >
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand" />
              {ACCOUNT_NAV.label}
              {caps.unreadNotifications > 0 && (
                <>
                  <span aria-hidden="true" className="badge bg-apricot-soft text-apricot-deep">
                    {caps.unreadNotifications}
                  </span>
                  {/* The number alone is not self-describing to a screen reader. */}
                  <span className="sr-only">{caps.unreadNotifications} unread</span>
                </>
              )}
            </NavLink>
            {/* Avatar before the way out, as the board has it: the identity
                reads first and "Sign out" ends the row, rather than the button
                sitting between a user's name and their own initials. */}
            <span
              aria-hidden="true"
              title={caps.profile.name}
              className="pixel-avatar grid h-8 w-8 shrink-0 place-items-center bg-mint text-sm font-black text-mint-deep"
            >
              {initials(caps.profile.name)}
            </span>
            <button onClick={signOut} className="btn btn-quiet btn-sm shrink-0">
              Sign out
            </button>
          </div>
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
