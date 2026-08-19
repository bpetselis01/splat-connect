/**
 * The homepage's six-tile section launcher.
 *
 * This is the fast path, and the reason the site needs no dropdown menus: a
 * visitor who knows where they are going leaves from here without scrolling, and
 * a stranger reads the whole site's shape and scale in one glance. Icons are
 * deliberately absent — the grid is for scanning, not looking.
 */
import Link from 'next/link'
import type { Route } from 'next'

export interface LauncherTile {
  href: Route
  label: string
  blurb: string
  /** Omitted where a number would be meaningless, e.g. About. */
  count?: number
}

export function LauncherGrid({ tiles }: { tiles: LauncherTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <Link key={tile.href} href={tile.href} className="card card-link px-4 py-4 text-center">
          {tile.count !== undefined && (
            <p className="text-2xl font-bold leading-none text-brand-deep">{tile.count}</p>
          )}
          <p className="mt-1.5 text-sm font-bold text-ink">{tile.label}</p>
          <p className="mt-1 text-xs leading-snug text-muted">{tile.blurb}</p>
        </Link>
      ))}
    </div>
  )
}
