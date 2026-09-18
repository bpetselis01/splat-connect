/**
 * Build requests — makers-wanted oversight.
 *
 * Two things go wrong with a build request and neither is an error state:
 * unclaimed for two weeks, or claimed and silent for ten days. Both are
 * computed from the clock rather than stored, and they are separate flags
 * because the answer differs — an unclaimed one needs promoting, a silent one
 * needs a nudge to a named person.
 *
 * Read-only. An admin who sees a stalled request acts in the thread like
 * anybody else; a button here that reached into somebody's exchange would be a
 * power the rest of the product does not give.
 */
import Link from 'next/link'
import { Hammer, Warning, Clock } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'

export const metadata = { title: 'Build requests — SPLAT Connect' }

type AdminBuild = {
  id: string
  status: string
  tutorial_title: string | null
  requester_suburb: string | null
  build_brief: string | null
  age_days: number
  idle_days: number
  unclaimed_too_long: boolean
  claimed_and_silent: boolean
}

export default async function AdminBuildRequestsPage() {
  const builds = await apiClient
    .get<AdminBuild[]>('/api/admin/build-requests')
    .catch(() => [] as AdminBuild[])

  const needsAttention = builds.filter((b) => b.unclaimed_too_long || b.claimed_and_silent)
  const rest = builds.filter((b) => !b.unclaimed_too_long && !b.claimed_and_silent)

  return (
    <div>
      <h1 className="title-hub">Build requests</h1>
      <p className="mb-6 mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Makers-wanted oversight. Unclaimed for two weeks, or claimed but silent for ten days —
        those are the two that need a person to look.
      </p>

      {builds.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No open build requests.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {[
            { label: 'Needs a look', list: needsAttention },
            { label: 'Moving along', list: rest },
          ]
            .filter((g) => g.list.length > 0)
            .map((group) => (
              <section key={group.label}>
                <h2 className="title-detail mb-3">
                  {group.label} ({group.list.length})
                </h2>
                <ul className="flex list-none flex-col gap-3">
                  {group.list.map((b) => (
                    <li key={b.id} className="card flex flex-wrap items-start gap-4 p-5">
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
                          b.unclaimed_too_long || b.claimed_and_silent
                            ? 'bg-honey-soft text-ink'
                            : 'bg-sunken text-brand-deep'
                        }`}
                      >
                        {b.unclaimed_too_long || b.claimed_and_silent ? (
                          <Warning className="h-5 w-5" />
                        ) : (
                          <Hammer className="h-5 w-5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">
                          {b.tutorial_title ?? 'A guide that is no longer published'}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {b.requester_suburb ?? 'No suburb'} · {b.status} · asked {b.age_days} day
                          {b.age_days === 1 ? '' : 's'} ago
                        </p>
                        {b.build_brief && (
                          <p className="mt-2 text-sm leading-relaxed text-muted">
                            “{b.build_brief}”
                          </p>
                        )}
                        {b.unclaimed_too_long && (
                          <p className="mt-2 text-sm font-semibold text-ink">
                            Nobody has claimed this in two weeks.
                          </p>
                        )}
                        {b.claimed_and_silent && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            Claimed, but nothing has moved in {b.idle_days} days.
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/dashboard/exchanges/build/${b.id}`}
                        className="btn btn-quiet btn-sm shrink-0"
                      >
                        Open the thread
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
