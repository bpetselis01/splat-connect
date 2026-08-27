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

export function BackToMySplatDock({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? ''
  if (!signedIn || sectionFor(pathname) === ACCOUNT_NAV) return null

  return (
    <BoundaryLink href={ACCOUNT_NAV.href} className="dock-my-splat">
      <span aria-hidden="true" className="dock-my-splat-dot" />
      Back to {ACCOUNT_NAV.label}
    </BoundaryLink>
  )
}
