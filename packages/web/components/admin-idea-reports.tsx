'use client'
/**
 * Reports against a person inside a design challenge (GET /api/admin/reports).
 *
 * Open ones carry a note field and two decisions: Remove takes the person out of
 * the challenge, Dismiss just closes the report and un-hides them for the
 * reporter. A resolved report whose person is still removed offers Reinstate.
 * The server refuses to remove the idea's author (409) and says why; that
 * sentence is shown as it arrives.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { apiMessage } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatRelativeTime } from '@/lib/relative-time'

export type IdeaReport = {
  id: string
  idea_id: string
  reported_profile_id: string
  reason: string
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
  removed: boolean
  toy_ideas: { title: string } | null
  reported_profile: { name: string | null } | null
  reporter: { name: string | null } | null
}

export function AdminIdeaReports({ reports }: { reports: IdeaReport[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function run(id: string, call: () => Promise<unknown>) {
    setError(null)
    setBusy(id)
    try {
      await call()
      startTransition(() => router.refresh())
    } catch (e) {
      setError(apiMessage(e, 'That did not save. Try once more.'))
    } finally {
      setBusy(null)
    }
  }
  const decide = (r: IdeaReport, action: 'remove' | 'dismiss') =>
    run(r.id, () => browserApiClient.patch(`/api/admin/reports/${r.id}`, { action, resolution_note: notes[r.id]?.trim() ?? '' }))
  const reinstate = (r: IdeaReport) =>
    run(r.id, () => browserApiClient.delete(`/api/admin/ideas/${r.idea_id}/participants/${r.reported_profile_id}/removal`))

  if (reports.length === 0) {
    return (
      <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
        No idea reports. Nobody has reported anyone in a challenge.
      </p>
    )
  }

  return (
    <div>
      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}
      <ul className="flex list-none flex-col gap-3">
        {reports.map((r) => {
          const open = r.resolved_at === null
          const who = r.reported_profile?.name ?? 'A member'
          return (
            <li key={r.id} className="rounded-card border-[length:var(--bw)] border-line bg-surface px-5 py-[18px]" style={{ boxShadow: 'var(--e1)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 text-base font-extrabold text-ink">
                  {who} · {r.toy_ideas?.title ?? 'a challenge'}
                </p>
                <span className="admin-tag py-[3px]" style={{ background: open ? 'var(--tcoral)' : 'var(--tok)' }}>
                  {open ? 'Open' : 'Resolved'}
                </span>
                {r.removed && <span className="admin-tag py-[3px]" style={{ background: 'var(--surface2)' }}>Removed</span>}
              </div>
              <p className="m-0 mt-1 text-sm text-muted">
                From {r.reporter?.name ?? 'a member'} · {formatRelativeTime(r.created_at)}
              </p>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.55] text-ink">{r.reason}</p>
              {!open && r.resolution_note && (
                <p className="m-0 mt-2 rounded-[14px] bg-sunken px-4 py-2 text-sm text-muted">
                  <strong className="font-bold text-ink">Decision note:</strong> {r.resolution_note}
                </p>
              )}

              {open && (
                <div className="mt-3 flex flex-col gap-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-bold text-ink">Note for the record</span>
                    <textarea
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      rows={2}
                      maxLength={2000}
                      className="field"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => decide(r, 'remove')} className="btn btn-primary btn-md">
                      Remove
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => decide(r, 'dismiss')} className="btn btn-quiet btn-md">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {!open && r.removed && (
                <div className="mt-3">
                  <button type="button" disabled={busy === r.id} onClick={() => reinstate(r)} className="btn btn-quiet btn-md">
                    Reinstate
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
