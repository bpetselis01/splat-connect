'use client'
/**
 * The way back to My SPLAT for a signed-in visitor out on the public site,
 * where nothing else points there.
 *
 * Deliberately not rendered anywhere in the account section. /dashboard is the
 * destination itself, and every other account page carries the rail, which has
 * had its own "Back to My SPLAT" pill at the top since 2026-08-24 (see
 * components/rail.tsx). Rendering here as well put two links to /dashboard on
 * every rail page — see docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md.
 *
 * Always a boundary-crossing destination from wherever this renders, so
 * BoundaryLink always resolves to a full page load here — see its own
 * docstring for why that matters.
 */
import { usePathname } from 'next/navigation'
import { BoundaryLink } from '@/components/boundary-link'
import { ACCOUNT_NAV, sectionFor } from '@/lib/public-nav'
import { CornerMenu, type CornerMenuItem } from '@/components/corner-menu'

// On the two library list pages (not their detail pages) the dock grows into
// a corner menu of that page's actions — see components/corner-menu.tsx.
// Items are ordered nearest-the-trigger first.
const LIBRARY_MENUS: Record<string, { label: string; items: CornerMenuItem[] }> = {
  '/library': {
    label: 'Library actions',
    items: [
      { label: 'Back to My SPLAT', href: '/dashboard', anchor: true },
      { label: 'Upload a tutorial', href: '/upload', primary: true },
      { label: 'My tutorials', href: '/dashboard/tutorials' },
      { label: 'Saved', href: '/dashboard/saved' },
    ],
  },
  '/toy-library': {
    label: 'Toy library actions',
    items: [
      { label: 'Back to My SPLAT', href: '/dashboard', anchor: true },
      { label: 'Give a toy', href: '/dashboard/toys/new', primary: true },
      { label: 'My toys', href: '/dashboard/toys' },
      { label: 'My exchanges', href: '/dashboard/exchanges' },
      { label: 'Saved', href: '/dashboard/saved' },
    ],
  },
}

export function BackToMySplatDock({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? ''
  if (!signedIn || sectionFor(pathname) === ACCOUNT_NAV) return null

  const menu = LIBRARY_MENUS[pathname]
  if (menu) return <CornerMenu label={menu.label} items={menu.items} />

  return (
    <BoundaryLink href={ACCOUNT_NAV.href} className="dock-my-splat">
      <span aria-hidden="true" className="dock-my-splat-dot" />
      Back to {ACCOUNT_NAV.label}
    </BoundaryLink>
  )
}
