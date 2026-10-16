/**
 * What the signed-in member reported, and what SPLAT said back (GET /api/reports).
 * The person reported is never told who filed it; the only reply here is the
 * note an admin wrote to the reporter. A report_resolved notice links here.
 */
import { shortDate } from '@splat-connect/types'
import { REPORT_CATEGORY, type ReportCategory } from '@/lib/report-labels'

export type MyReport = {
  id: string
  subject_label: string
  category: ReportCategory
  status: 'new' | 'looking' | 'resolved'
  note_to_reporter: string | null
  created_at: string
}

const STATUS = {
  new: { label: 'Sent', tint: 'var(--tcoral)' },
  looking: { label: 'Being looked at', tint: 'var(--tamber)' },
  resolved: { label: 'Resolved', tint: 'var(--tok)' },
} as const

export function MyReportsList({ reports }: { reports: MyReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-[18px] border border-line bg-surface p-6 text-center">
        <p className="m-0 font-display text-xl font-extrabold text-ink">No reports yet</p>
        <p className="m-0 mt-1 text-sm text-muted">
          When you report a problem, you can follow what happened to it here.
        </p>
      </div>
    )
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {reports.map((r) => (
        <li key={r.id} className="rounded-[18px] border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-base font-extrabold text-ink">{r.subject_label}</p>
            <span className="admin-tag py-[3px]" style={{ background: STATUS[r.status].tint }}>
              {STATUS[r.status].label}
            </span>
          </div>
          <p className="m-0 mt-1 text-sm text-muted">
            {REPORT_CATEGORY[r.category]} · Sent {shortDate(r.created_at)}
          </p>
          {r.note_to_reporter && (
            <p className="m-0 mt-2.5 rounded-[14px] bg-sunken px-4 py-2 text-sm text-muted">
              <strong className="font-bold text-ink">From SPLAT:</strong> {r.note_to_reporter}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
