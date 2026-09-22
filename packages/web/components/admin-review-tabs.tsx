import Link from 'next/link'
import type { Route } from 'next'

/**
 * The four review queues as one tab track, as the board draws them. Links,
 * because each is its own route.
 */
export function ReviewTabs({
  current,
  guides,
  ideas,
}: {
  current: 'guides' | 'ideas' | 'orgs' | 'spot'
  guides?: number
  ideas?: number
}) {
  const tabs = [
    { key: 'guides', label: 'Guides', href: '/admin/review', n: guides },
    { key: 'ideas', label: 'Ideas', href: '/admin/ideas', n: ideas },
    { key: 'orgs', label: 'Organisations', href: '/admin/organization-requests' },
    { key: 'spot', label: 'Spot check', href: '/admin/spot-check' },
  ] as const
  return (
    <nav aria-label="Review queues" className="seg-tabs">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href as Route}
          aria-current={t.key === current ? 'page' : undefined}
          className={t.key === current ? '' : 'text-muted'}
        >
          {t.label}
          {'n' in t && t.n !== undefined && (
            <span
              className="rounded-full px-2 py-px text-xs"
              style={{ background: t.key === current ? 'var(--tcoral)' : 'var(--surface)' }}
            >
              {t.n}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
