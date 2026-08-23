'use client'
/**
 * The way back to My SPLAT from anywhere that has no header pointing there:
 * every public page for a signed-in visitor, and every account page except
 * /dashboard itself (which keeps the header instead of the rail — see
 * docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md).
 *
 * Always a boundary-crossing destination from wherever this renders (it only
 * renders where there is no header, and /dashboard always has one), so
 * BoundaryLink always resolves to a full page load here — see its own
 * docstring for why that matters.
 */
import { usePathname } from 'next/navigation'
import { BoundaryLink } from '@/components/boundary-link'
import { ACCOUNT_NAV } from '@/lib/public-nav'

export function BackToMySplatDock({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? ''
  if (!signedIn || pathname === ACCOUNT_NAV.href) return null

  return (
    <BoundaryLink href={ACCOUNT_NAV.href} className="dock-my-splat">
      <span aria-hidden="true" className="dock-my-splat-dot" />
      Back to {ACCOUNT_NAV.label}
    </BoundaryLink>
  )
}
