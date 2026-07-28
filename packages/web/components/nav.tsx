/**
 * Navigation Bar Component
 *
 * Top navigation showing SPLAT Connect branding and user menu.
 * Displayed on every page (from root layout.tsx).
 *
 * Props:
 * - role: User role ('admin' | 'contributor' | null for logged-out)
 *
 * Navigation items (dynamic based on role):
 * - Library: Browse approved tutorials (everyone)
 * - Dashboard: Contributor hub (contributors only)
 * - Admin: Admin dashboard (admins only)
 * - Sign Out: Logout button (if authenticated)
 *
 * Data flow:
 * 1. layout.tsx fetches user session
 * 2. Passes user.role to Nav component
 * 3. Nav renders different links based on role
 * 4. User clicks link → navigates to page
 * 5. Page middleware validates access (middleware.ts)
 *
 * Features:
 * - Responsive design (wraps on mobile)
 * - Current-page indicator driven by the pathname
 * - Sign out button with Supabase auth integration
 * - Links change based on user role
 * - Branding with emoji logo
 *
 * Related files:
 * - app/layout.tsx: Root layout, calls Nav
 * - middleware.ts: Validates route access
 * - routes/contributors.ts: Fetches user profile (for role)
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/icons'
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

  // `as const` keeps the hrefs as literals so they satisfy Next's typed routes.
  const links = ([
    { href: '/library', label: 'Library', show: true },
    // Shown to anyone signed in, not just leaders: it is a directory, and gating it
    // on leadership would need a per-request lookup in the nav for no benefit — a
    // leader is an ordinary contributor.
    { href: '/organizations', label: 'Organisations', show: role !== null },
    { href: '/admin', label: 'Admin', show: role === 'admin' },
    { href: '/dashboard', label: 'Dashboard', show: role === 'contributor' },
    { href: '/upload', label: 'Upload', show: role === 'contributor' },
    { href: '/my-tutorials', label: 'My Tutorials', show: role === 'contributor' },
  ] as const).filter((l) => l.show)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-bold text-ink sm:text-lg"
        >
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-brand-tint text-brand-dark">
            <Logo className="h-5 w-5" />
          </span>
          SPLAT Connect
        </Link>

        {/* On narrow screens the links drop to their own row so the logo and the
            account control stay together on the first one. */}
        <div className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:ml-auto sm:w-auto">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-brand-tint text-brand-deep'
                    : 'text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
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
            href="/signup"
            className="btn btn-accent btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0"
          >
            Contribute
          </Link>
        )}
      </nav>
    </header>
  )
}
