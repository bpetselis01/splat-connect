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
        <ul className="flex list-none flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id} className="card flex flex-wrap items-center gap-4 p-5">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
                  j.stalled ? 'bg-honey-soft text-ink' : 'bg-sunken text-brand-deep'
                }`}
              >
                {j.stalled ? <Warning className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  {j.tutorial_title ?? 'A guide that is no longer published'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {/* An event-hosted job has no printer: 061 made a build day a
                      valid destination for one. */}
                  {j.printer_name ?? (j.event_id ? 'Printed at a build day' : 'No printer')} ·
                  untouched {j.idle_days} day{j.idle_days === 1 ? '' : 's'}
                  {j.decline_reason && ` · declined — ${j.decline_reason}`}
                </p>
                {j.stalled && (
                  <p className="mt-1 text-sm font-semibold text-ink">
                    Accepted, not started, ten days quiet.
                  </p>
                )}
              </div>

              <Badge status={j.status} />
              <Link
                href={`/dashboard/print-requests/${j.id}`}
                className="btn btn-quiet btn-sm shrink-0"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
