/**
 * The dashboard tab strip. Presentational: it receives the tabs it should
 * show rather than deriving them, so it can be tested without mocking any
 * capability fetches — the decision about who sees which tab lives in one
 * place (app/dashboard/layout.tsx).
 *
 * An affordance, not a control. Each tab's page re-checks its own access
 * (and the API/database enforce it too) — see lib/org-access.ts for the
 * same rule stated about organisations.
 *
 * `pathname` is an injectable prop rather than read via usePathname() here,
 * so this component stays free of Next runtime mocking in its unit test.
 * A thin client wrapper (components/dashboard-nav.tsx) supplies the real
 * value from usePathname() when this renders inside the app.
 */
import Link from 'next/link'

export type DashboardTab = { href: string; label: string }

export function DashboardTabs({
  tabs,
  pathname,
}: {
  tabs: DashboardTab[]
  pathname: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line">
      {tabs.map((tab) => {
        // Exact match, not startsWith: /dashboard is a prefix of every other
        // tab href, so that would mark Tutorials current everywhere.
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'border-brand-dark text-brand-deep'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
