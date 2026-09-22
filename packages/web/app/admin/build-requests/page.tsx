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
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr'
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

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** The board's second line: how long, in the words that say what is wrong. */
function ageLine(b: AdminBuild): string {
  if (b.claimed_and_silent) return `Claimed, no movement in ${days(b.idle_days)}`
  if (b.unclaimed_too_long) return `${days(b.age_days)} unclaimed`
  if (b.status === 'accepted') return `Claimed · ${days(b.age_days)} open`
  return `${days(b.age_days)} open`
}

export default async function AdminBuildRequestsPage() {
  const builds = await apiClient
    .get<AdminBuild[]>('/api/admin/build-requests')
    .catch(() => [] as AdminBuild[])

  // One list, the flagged ones first — the board's order.
  const flagged = (b: AdminBuild) => b.unclaimed_too_long || b.claimed_and_silent
  const sorted = [...builds].sort((a, b) => Number(flagged(b)) - Number(flagged(a)))

  return (
    <div className="max-w-[980px]">
      <h1 className="title-hub">Build requests</h1>
      <p className="mt-2 mb-[22px] max-w-[62ch] text-[15px] text-muted">
        Makers wanted, from the top. Anything unclaimed for two weeks, or claimed and silent for
        ten days, is flagged so a family is never left waiting quietly.
      </p>

      {sorted.length === 0 ? (
        <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
          No open build requests.
        </p>
      ) : (
        <ul className="grid list-none gap-2.5">
          {sorted.map((b) => {
            const stale = flagged(b)
            return (
              <li
                key={b.id}
                className="admin-row flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-ink">
                    {b.tutorial_title ?? 'A guide that is no longer published'}{' '}
                    <span className="font-semibold text-muted">
                      · Family in {b.requester_suburb ?? 'an unknown suburb'}
                    </span>
                  </p>
                  <p className="mt-[3px] text-sm text-muted">
                    {ageLine(b)}
                    {b.build_brief && <> · “{b.build_brief}”</>}
                  </p>
                </div>
                {/* Read-only: an admin who sees a stalled request acts in the
                    thread like anybody else. The board's Nudge / Reopen / Ask an
                    organisation verbs have no endpoint behind them. */}
                <span className="flex items-center gap-2">
                  <span
                    className="admin-tag py-[5px]"
                    style={{ background: stale ? 'var(--tamber)' : 'var(--tok)' }}
                  >
                    {stale ? (
                      <WarningCircle size={14} weight="fill" aria-hidden="true" />
                    ) : (
                      <CheckCircle size={14} weight="fill" aria-hidden="true" />
                    )}
                    {b.claimed_and_silent ? 'Stalled' : stale ? 'Needs attention' : 'Healthy'}
                  </span>
                  <Link
                    href={`/dashboard/exchanges/build/${b.id}`}
                    className={`btn btn-md ${stale ? 'btn-primary' : 'btn-quiet'}`}
                  >
                    Open the thread
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
