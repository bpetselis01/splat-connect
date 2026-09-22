/**
 * Print jobs — every job on the platform.
 *
 * "Stalled" is not a status column and deliberately not: a job that stalls and
 * then moves is not a job that changed state, it is a job whose printer got to
 * it. Accepted, not ready, untouched for ten days — computed on read, and
 * sorted to the top.
 *
 * Read-only, for the same reason as the build queue.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { Warning } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import type { AdminAccountsResponse, ToyTransactionStatus } from '@splat-connect/types'

export const metadata = { title: 'Print jobs — SPLAT Connect' }

type AdminPrintJob = {
  id: string
  status: ToyTransactionStatus
  tutorial_title: string | null
  printer_name: string | null
  requester_id: string | null
  event_id: string | null
  printing_started_at: string | null
  ready_at: string | null
  idle_days: number
  stalled: boolean
  decline_reason: string | null
}

type Filter = 'all' | 'stalled' | 'open' | 'done' | 'closed'

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['stalled', 'Stalled'],
  ['open', 'Open'],
  ['done', 'Collected'],
  ['closed', 'Expired / declined'],
]

function bucket(j: AdminPrintJob): Exclude<Filter, 'all'> {
  if (j.stalled) return 'stalled'
  if (j.status === 'completed') return 'done'
  if (j.status === 'rejected' || j.status === 'withdrawn') return 'closed'
  return 'open'
}

/** The board's status pill: the stage in words, on its tint. */
function stage(j: AdminPrintJob): { label: string; tint: string } {
  if (j.stalled) return { label: 'Accepted · stalled', tint: 'var(--tcoral)' }
  switch (j.status) {
    case 'requested':
      return { label: 'Requested', tint: 'var(--tamber)' }
    case 'accepted':
      if (j.ready_at) return { label: 'Ready for pickup', tint: 'var(--tmint)' }
      return { label: j.printing_started_at ? 'Printing' : 'Accepted', tint: 'var(--b100)' }
    case 'completed':
      return { label: 'Collected', tint: 'var(--tok)' }
    case 'rejected':
      return { label: 'Declined', tint: 'var(--surface2)' }
    default:
      return { label: 'Withdrawn', tint: 'var(--surface2)' }
  }
}

export default async function AdminPrintJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>
}) {
  const { show } = await searchParams
  const [jobs, accounts] = await Promise.all([
    apiClient.get<AdminPrintJob[]>('/api/admin/print-jobs').catch(() => [] as AdminPrintJob[]),
    // Requester names, resolved from the accounts list rather than embedded —
    // embedding profiles kills the query under the 033/045 grants.
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors').catch(() => null),
  ])
  const nameOf = new Map((accounts?.accounts ?? []).map((a) => [a.id, a.name || a.email]))
  const filter: Filter = FILTERS.some(([k]) => k === show) ? (show as Filter) : 'all'
  const shown = filter === 'all' ? jobs : jobs.filter((j) => bucket(j) === filter)

  return (
    <div className="max-w-[1100px]">
      <h1 className="title-hub">Print jobs</h1>
      <p className="mt-1.5 mb-5 max-w-[60ch] text-base text-muted">
        Every job on the platform. Stalled means accepted but not moved in ten days — nudge the
        printer, or reopen it to the other printers the family asked.
      </p>

      {/* Links, not buttons: the filter is part of the address, so a stalled
          list can be bookmarked and the page stays a server component. */}
      <nav aria-label="Filter print jobs" className="mb-[18px] flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const n = key === 'all' ? jobs.length : jobs.filter((j) => bucket(j) === key).length
          const on = key === filter
          return (
            <Link
              key={key}
              href={(key === 'all' ? '/admin/print-jobs' : `/admin/print-jobs?show=${key}`) as Route}
              aria-current={on ? 'page' : undefined}
              className="inline-flex min-h-11 items-center rounded-full border-[length:var(--bw)] border-line px-3.5 text-sm font-bold no-underline"
              style={{
                background: on ? 'var(--ink)' : 'var(--surface)',
                color: on ? 'var(--canvas)' : 'var(--ink)',
              }}
            >
              {label} · {n}
            </Link>
          )
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
          {jobs.length === 0 ? 'No print jobs yet.' : 'None in this view.'}
        </p>
      ) : (
        <div className="admin-table-card rounded-[18px]">
          <div className="overflow-x-auto">
            <table className="admin-table admin-table--caps">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Printer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Age</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((j) => {
                  const st = stage(j)
                  return (
                    <tr key={j.id} style={j.stalled ? { background: 'var(--tcoral)' } : undefined}>
                      <td className="font-bold">
                        {j.stalled && (
                          <Warning
                            size={16}
                            weight="fill"
                            aria-label="Stalled"
                            className="mr-1.5 inline align-[-2px] text-warning"
                          />
                        )}
                        {j.tutorial_title ?? 'A guide that is no longer published'}
                        {j.decline_reason && (
                          <span className="block text-xs font-normal text-muted">
                            Declined — {j.decline_reason}
                          </span>
                        )}
                      </td>
                      <td className="text-muted">
                        {(j.requester_id && nameOf.get(j.requester_id)) ?? '—'}
                      </td>
                      <td>
                        {/* An event-hosted job has no printer: 061 made a build
                            day a valid destination for one. */}
                        {j.printer_name ?? (j.event_id ? 'Printed at a build day' : 'No printer')}
                      </td>
                      <td>
                        <span className="admin-tag px-2.5" style={{ background: st.tint }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[13px] text-muted">
                        {j.idle_days === 0 ? 'Today' : `${j.idle_days} day${j.idle_days === 1 ? '' : 's'}`}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/print-requests/${j.id}`}
                          className="btn btn-quiet btn-sm shadow-none"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-[13px] text-muted">{shown.length} jobs shown</p>
    </div>
  )
}
