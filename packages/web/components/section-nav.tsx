/**
 * The second navigation row: siblings within the active section.
 *
 * This is what makes a dropdown unnecessary. The top bar gets you into a
 * section; this gets you anywhere inside it in one click, with plain links —
 * no hover, no focus trap, no aria-expanded, nothing to get wrong for a
 * keyboard or screen-reader user.
 *
 * Renders nothing for /library and /toy-library, which are flat catalogues with
 * no children. Overview is synthesised from the section rather than duplicated
 * into PUBLIC_NAV, so a hub can never be missing from its own subnav.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { sectionFor } from '@/lib/public-nav'

export function SectionNav({ pathname }: { pathname: string }) {
  const section = sectionFor(pathname)
  if (!section || section.children.length === 0) return null

  const items = [
    { href: section.href, label: 'Overview', state: 'live' as const },
    ...section.children,
  ]

  return (
    <nav
      aria-label={`${section.label} pages`}
      className="border-b border-line bg-canvas"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== section.href && pathname.startsWith(`${item.href}/`))
          return (
            <Link
              key={item.href}
              // Cast: most of these routes are built in later tasks, so
              // typedRoutes doesn't know them yet.
              href={item.href as Route<string>}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-brand text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
              {item.state === 'soon' && (
                <span className="badge bg-honey-soft text-honey-deep">SOON</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
