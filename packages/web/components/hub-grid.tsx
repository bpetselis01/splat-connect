/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 */
import Link from 'next/link'
import type { Route } from 'next'
import type { NavItem } from '@/lib/public-nav'

export function HubGrid({ items }: { items: NavItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          // Cast: most of these routes are built in later tasks, so
          // typedRoutes doesn't know them yet.
          href={item.href as Route<string>}
          className="card card-link p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-ink">{item.label}</h3>
            {item.state === 'soon' && (
              <span className="badge bg-honey-soft text-honey-deep">SOON</span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.blurb}</p>
        </Link>
      ))}
    </div>
  )
}
