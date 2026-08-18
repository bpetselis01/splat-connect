import Link from 'next/link'
import type { Route } from 'next'
import { ImpactCard } from '@/components/impact-card'
import type { ImpactSummary } from '@splat-connect/types'

// Same shape the empty grid/strip below already render for zero rows, so a
// fetch failure just looks like "nothing yet" rather than a separate error UI.
const EMPTY_IMPACT: ImpactSummary = {
  totals: { tutorials: 0, toysShared: 0, toysDelivered: 0, contributors: 0, organisations: 0 },
  recent: [],
  contributors: [],
  organisations: [],
}

export default async function ImpactPage() {
  let impact: ImpactSummary = EMPTY_IMPACT
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/impact`, { cache: 'no-store' })
    if (res.ok) impact = await res.json()
  } catch {
    impact = EMPTY_IMPACT
  }

  const { totals, recent, contributors, organisations } = impact
  const stats = [
    { label: 'Tutorials', count: totals.tutorials },
    { label: 'Toys shared', count: totals.toysShared },
    { label: 'Toys delivered', count: totals.toysDelivered },
    { label: 'Contributors', count: totals.contributors },
    { label: 'Organisations', count: totals.organisations },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Community impact</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Tutorials written, toys shared, and deliveries made by the people and organisations
        behind SPLAT.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} data-testid={`impact-stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`} className="card-flat px-4 py-5 text-center">
            <p className="text-2xl font-bold text-brand-deep">{s.count}</p>
            <p className="mt-1 text-sm font-semibold text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-ink">Recently active</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {recent.map((r) => (
              <Link
                key={`${r.kind}-${r.id}`}
                // Cast: /contributors/[id] and /organizations/[id]/public are
                // built by sibling tasks, so typedRoutes doesn't know them yet.
                href={
                  (r.kind === 'person'
                    ? `/contributors/${r.id}`
                    : `/organizations/${r.id}/public`) as Route<string>
                }
                className="card card-link shrink-0 px-4 py-3"
              >
                <p className="max-w-40 truncate text-sm font-bold text-ink">{r.name}</p>
                <span
                  className={`badge mt-1 ${
                    r.kind === 'person' ? 'bg-brand-tint text-brand-deep' : 'bg-mint-soft text-mint-deep'
                  }`}
                >
                  {r.kind === 'person' ? 'Person' : 'Organisation'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold text-ink">Contributors and organisations</h2>
        {contributors.length === 0 && organisations.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge">
              🤝
            </span>
            <p className="mt-4 font-bold text-ink">No contributors yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Check back soon — this page tracks tutorials, toys, and deliveries across the
              community.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contributors.map((c) => (
              <ImpactCard key={`person-${c.id}`} kind="person" entity={c} />
            ))}
            {organisations.map((o) => (
              <ImpactCard key={`org-${o.id}`} kind="org" entity={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
