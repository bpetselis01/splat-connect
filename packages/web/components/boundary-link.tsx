'use client'
import Link from 'next/link'
import type { Route } from 'next'
import type { ComponentProps } from 'react'
import { usePathname } from 'next/navigation'
import { crossesAccountBoundary } from '@/lib/public-nav'

/**
 * Drop-in replacement for next/link's <Link>, for any call site whose
 * destination might cross the account/public boundary — not just the header
 * (components/nav.tsx), which was the only place this was wired in until the
 * final review round found eight more unguarded sites (the public footer, the
 * dashboard hub's "Submit an idea" tile, and several dashboard pages linking
 * out to public destinations, plus /upload and the tutorial editor linking
 * back to /dashboard).
 *
 * Crossing the boundary needs a full navigation, not a soft client
 * transition: the root layout (which decides the rail, the backdrop and the
 * quiet header) does not re-run on client-side routing, so it can go stale —
 * see lib/public-nav.ts's crossesAccountBoundary.
 *
 * Safe to use for a link that never crosses, too: crossesAccountBoundary
 * returns false and this renders through next/link exactly as before, which
 * is why components/hub-grid.tsx (shared by every public hub *and* the
 * dashboard hub) can use it unconditionally rather than branching on caller.
 */
export function BoundaryLink({
  href,
  children,
  ...rest
}: { href: string } & Omit<ComponentProps<'a'>, 'href'>) {
  const pathname = usePathname() ?? ''
  if (crossesAccountBoundary(pathname, href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href as Route<string>} {...rest}>
      {children}
    </Link>
  )
}
