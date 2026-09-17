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
import { Printer, Warning } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import type { ToyTransactionStatus } from '@splat-connect/types'

export const metadata = { title: 'Print jobs — SPLAT Connect' }

type AdminPrintJob = {
  id: string
  status: ToyTransactionStatus
  tutorial_title: string | null
  printer_name: string | null
  event_id: string | null
  idle_days: number
  stalled: boolean
  decline_reason: string | null
}

export default async function AdminPrintJobsPage() {
  const jobs = await apiClient
    .get<AdminPrintJob[]>('/api/admin/print-jobs')
    .catch(() => [] as AdminPrintJob[])

  const stalled = jobs.filter((j) => j.stalled).length

  return (
    <div>
      <h1 className="title-hub">Print jobs</h1>
      <p className="mb-6 mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Every job on the platform. Stalled — accepted but not moved in ten days —
        {stalled > 0 ? ` ${stalled} of them, ` : ' none right now, '}
        sorts to the top.
      </p>

      {jobs.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No print jobs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* JOB | PRINTER | STATUS | AGE, as the board draws this queue. Its
              REQUESTER column is absent: /api/admin/print-jobs returns no
              requester, and inventing one is worse than a missing column. */}
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Job</th>
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Printer</th>
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Status</th>
                <th scope="col" className="eyebrow whitespace-nowrap pb-2 pr-3 text-right text-muted">
                  Age
                </th>
                <th scope="col" className="pb-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-line align-middle last:border-0">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
                          j.stalled ? 'bg-honey-soft text-ink' : 'bg-sunken text-brand-deep'
                        }`}
                      >
                        {j.stalled ? (
                          <Warning className="h-5 w-5" />
                        ) : (
                          <Printer className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">
                          {j.tutorial_title ?? 'A guide that is no longer published'}
                        </span>
                        {j.stalled && (
                          <span className="block text-xs text-muted">
                            Accepted, not started, ten days quiet.
                          </span>
                        )}
                        {j.decline_reason && (
                          <span className="block text-xs text-muted">
                            Declined — {j.decline_reason}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-sm text-muted">
                    {/* An event-hosted job has no printer: 061 made a build day a
                        valid destination for one. */}
                    {j.printer_name ?? (j.event_id ? 'Printed at a build day' : 'No printer')}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge status={j.status} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-right text-sm tabular-nums text-muted">
                    {j.idle_days} day{j.idle_days === 1 ? '' : 's'}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/dashboard/print-requests/${j.id}`}
                      className="btn btn-quiet btn-sm"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
