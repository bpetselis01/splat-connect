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
  style,
  'aria-current': ariaCurrent,
  children,
}: {
  href: string
  crossing: boolean
  className: string
  /** Carries the section's --pill-tint/--pill-ink through to the CSS. */
  style?: React.CSSProperties
  'aria-current'?: 'page'
  children: React.ReactNode
}) {
  if (crossing) {
    return (
      <a href={href} aria-current={ariaCurrent} className={className} style={style}>
        {children}
      </a>
    )
  }
  return (
    <Link
      href={href as Route<string>}
      aria-current={ariaCurrent}
      className={className}
      style={style}
    >
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
    // No `border-b border-line` here. app/globals.css already gives
    // `.pixel header` the board's 3px ink rule and `.pixel header.nav-quiet`
    // the hairline the quiet register wants — but both sit in @layer
    // components, and a Tailwind utility wins over that layer whatever the
    // specificity says. The utility was silently overriding the correct rule
    // back to 1px of --color-line on every page.
    <header className={`sticky top-0 z-30 ${quiet ? 'nav-quiet' : 'bg-surface'}`}>
      <nav
        className={`public-shell flex flex-wrap items-center gap-x-[26px] gap-y-2 ${
          quiet ? 'py-1.5' : 'py-[14px]'
        }`}
      >
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
          className="flex shrink-0 items-center gap-2.5 text-[18px] font-black tracking-tight text-ink"
        >
          {/* The mark sits on a plain tinted disc — no ring. The wordmark is the
              only thing in the bar that is not a pill, and it earns that by
              being the heaviest weight on the page rather than by being drawn. */}
          <span
            aria-hidden="true"
            className="pixel-avatar grid h-[34px] w-[34px] place-items-center bg-brand-tint text-brand-dark"
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
        {/* gap-x-5 is the board's 20px between tabs; ml-2 is its 8px, which
            lands on top of the bar's own 26px gap to give the 34px the board
            puts between the wordmark and "Guides". */}
        <div className="order-3 ml-2 flex w-full flex-wrap items-center gap-x-5 gap-y-1 sm:order-2 sm:w-auto">
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
                // No horizontal padding, at rest OR active. A pill-shaped hit
                // area was the last piece of the old rounded-pill nav left
                // standing, and seven of them at px-3.5 is ~170px the bar does
                // not have: the row overflowed its shell and wrapped, which is
                // what made the shelf render 116px tall against the board's
                // 71px. Hover and current-page both draw their pill on
                // `.nav-pill::before` instead, which costs no layout at all —
                // and stops the row shifting sideways as you navigate, which
                // is what the active `px-3` used to do. The vertical padding
                // stays — it is what keeps every pill a 40px target, well
                // clear of the 24px floor.
                className="nav-pill flex items-center gap-1.5 whitespace-nowrap py-3"
                // The section's own tone, handed to CSS so hover and
                // current-page can tint per-section without seven variants of
                // the rule. Same bg/fg pair tone.test.ts checks for contrast.
                style={
                  {
                    '--pill-tint': tone.hex.bg,
                    '--pill-ink': tone.hex.fg,
                  } as React.CSSProperties
                }
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
          // the avatar, "My SPLAT" with its unread count, and the way out, in
          // that order. They were three loose flex children each doing their
          // own ordering, which is why sign-out ended up on the pills' row.
          <div className="order-2 ml-auto flex shrink-0 items-center gap-[14px] sm:order-3">
            {/* Avatar first, then the door, then the way out. The identity
                reads before the destination — and with My SPLAT now drawn as a
                solid button rather than a bare label, an avatar sitting to its
                right read as a stray chip that had come loose from the button. */}
            <span
              aria-hidden="true"
              title={caps.profile.name}
              className="pixel-avatar grid h-8 w-8 shrink-0 place-items-center bg-mint text-sm font-black text-mint-deep"
            >
              {initials(caps.profile.name)}
            </span>
            <NavLink
              href={ACCOUNT_NAV.href}
              // Not `activeSection !== ACCOUNT_NAV`: that missed the split
              // inside the account section itself — from a rail-only page
              // (still ACCOUNT_NAV) to /dashboard (no rail), nestsRail
              // differs, so it is a crossing too. crossesAccountBoundary is
              // the one place that rule lives; see its docstring.
              crossing={crossesAccountBoundary(pathname, ACCOUNT_NAV.href)}
              aria-current={activeSection?.href === ACCOUNT_NAV.href ? 'page' : undefined}
              // The apricot button, not a `.nav-pill`, and not conditional on
              // where you are. As a bare label it was the quietest thing in a
              // bar of seven tinted section tabs — the one control a signed-in
              // person actually needs was the hardest one to find. `.btn-accent`
              // is the same solid apricot the signed-out "Sign in" uses, so the
              // far-right corner means "your way in" in both states.
              //
              // No --pill-tint/--pill-ink here any more: those feed `.nav-pill`'s
              // hover and current-page ::before, and the class is gone. Still no
              // tone dot — see the seven section tabs above for why that absence
              // is what separates this cluster from them.
              className="btn btn-accent btn-sm flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            >
              {ACCOUNT_NAV.label}
              {caps.unreadNotifications > 0 && (
                <>
                  {/* Ink on apricot, not the apricot-soft/apricot-deep pair the
                      badge carries elsewhere: that pairing is drawn for a white
                      shelf and all but disappeared once the button underneath it
                      became apricot too. */}
                  <span aria-hidden="true" className="badge bg-ink text-surface">
                    {caps.unreadNotifications}
                  </span>
                  {/* The number alone is not self-describing to a screen reader. */}
                  <span className="sr-only">{caps.unreadNotifications} unread</span>
                </>
              )}
            </NavLink>
            {/* The board draws this one with a solid ink shadow, not the 35%
                one `.btn-quiet` carries. The class itself stays untouched:
                that softer shadow is exactly what the board specifies for the
                hero's "Or borrow a toy", so changing it would fix the header
                and break the hero. */}
            <button
              onClick={signOut}
              className="btn btn-quiet btn-sm shrink-0 shadow-[3px_3px_0_var(--color-ink)]"
            >
              Sign out
            </button>
          </div>
        ) : (
          // `ml-auto` with no `sm:ml-0`. The signed-out button belongs at the
          // far right edge, where the signed-in cluster sits — the override
          // was cancelling it at 640px and up, dropping "Sign in" against the
          // end of the tab row instead.
          <Link href="/login" className="btn btn-accent btn-sm order-2 ml-auto shrink-0 sm:order-3">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
