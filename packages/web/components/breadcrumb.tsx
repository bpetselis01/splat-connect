'use client'
/**
 * Where you are, on pages that sit inside a section.
 *
 * The site is two levels deep, so this is deliberately not a full trail — a
 * `Home / Learn / Switch types` chain would restate the h1 sitting directly
 * beneath it, and breadcrumbs earn their place at three levels, not two. What a
 * visitor actually needs here is the way back up, so that is all this renders.
 *
 * Renders nothing on the homepage — a link pointing at the page you are on is
 * noise. On a section hub it points Home, as the board draws it: a hub is a
 * page people land on from search as often as from the nav above it, and the
 * board puts "← Home" over every one of them.
 *
 * Reads its own pathname via usePathname (same pattern as components/nav.tsx)
 * rather than taking it as a prop from the server layout: the layout only
 * re-reads headers() on a hard page load, so a prop computed there goes stale
 * across any soft <Link> transition and leaves the previous page's section
 * label stuck on screen indefinitely.
 *
 * Inside the account section it is a full trail instead — `My SPLAT / My
 * tutorials / Tutorial editor` — because that is the only way back up since the
 * navigation rail was retired on 2026-09-17. lib/trail.ts owns that model; this
 * component only draws it.
 *
 * Uses BoundaryLink, not next/link directly: a public crumb points out of
 * whatever section it renders in, which can be a boundary crossing — the exact
 * stale-chrome bug BoundaryLink exists to prevent (see its own docstring).
 */
import { usePathname } from 'next/navigation'
import { BoundaryLink } from '@/components/boundary-link'
import { ACCOUNT_NAV, sectionFor } from '@/lib/public-nav'
import { trailFor } from '@/lib/trail'
import { toneClass } from '@/lib/tone'

export function Breadcrumb() {
  const pathname = usePathname() ?? ''
  if (pathname === '/') return null

  const section = sectionFor(pathname)
  if (!section) return null

  // The board draws no trail over My SPLAT itself — a signed-in user's way out
  // of their account root is not the public homepage — and trailFor returns []
  // there for the same reason.
  if (section === ACCOUNT_NAV) {
    const crumbs = trailFor(pathname)
    if (crumbs.length === 0) return null
    return (
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {crumbs.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden="true" className="text-muted">
                  /
                </span>
              )}
              {crumb.href ? (
                <BoundaryLink
                  href={crumb.href}
                  className="eyebrow text-brand-dark transition-colors hover:text-brand-deep"
                >
                  {crumb.label}
                </BoundaryLink>
              ) : (
                // The current page. aria-current marks it for a screen reader;
                // no href, per the WAI-ARIA breadcrumb pattern.
                <span aria-current="page" className="eyebrow text-muted">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }

  // On the hub itself the way up is Home; inside a section it is the hub.
  const onHub = pathname === section.href
  const href = onHub ? '/' : section.href
  const label = onHub ? 'Home' : section.label
  const tone = toneClass(section.tone)

  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <BoundaryLink
        href={href}
        className="eyebrow inline-flex items-center gap-2 text-brand-dark transition-colors hover:text-brand-deep"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span aria-hidden="true">←</span>
        {label}
      </BoundaryLink>
    </nav>
  )
}
