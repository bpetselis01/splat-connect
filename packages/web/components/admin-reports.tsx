'use client'
/**
 * Private problem reports.
 *
 * Safety sits at the top whatever its age — the API sorts that way and this
 * renders in the order it arrives. Three states, and the button offered is the
 * next one: New shows "Start looking", Looking shows "Resolve", Resolved shows
 * neither.
 *
 * "Note to reporter" is the only message this screen can send, and that is the
 * whole design. The person reported is never told who filed it, so there is no
 * control here that could reach them — 065 has no column that would carry one.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldWarning,
  UserMinus,
  WarningCircle,
  FileX,
  ChatsTeardrop,
  DotsThreeCircle,
  ChatCircleDots,
  Check,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatRelativeTime } from '@/lib/relative-time'

export type MemberReport = {
  id: string
  subject_kind: string
  subject_label: string
  category: 'safety' | 'no_show' | 'arrived_broken' | 'wrong_info' | 'conduct' | 'other'
  body: string
  ok_to_contact: boolean
  status: 'new' | 'looking' | 'resolved'
  note_to_reporter: string | null
  reporter_name: string | null
  created_at: string
}

const CATEGORY: Record<MemberReport['category'], string> = {
  safety: 'Safety concern',
  no_show: 'Didn’t show up',
  arrived_broken: 'Arrived broken',
  wrong_info: 'Wrong or missing info',
  conduct: 'How someone behaved',
  other: 'Something else',
}

const CATEGORY_ICON = {
  safety: ShieldWarning,
  no_show: UserMinus,
  arrived_broken: WarningCircle,
  wrong_info: FileX,
  conduct: ChatsTeardrop,
  other: DotsThreeCircle,
} as const

const STATUS = {
  new: { label: 'New', tint: 'var(--tcoral)' },
  looking: { label: 'Looking into it', tint: 'var(--tamber)' },
  resolved: { label: 'Resolved', tint: 'var(--tok)' },
} as const

export function AdminReports({ reports }: { reports: MemberReport[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [noting, setNoting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.patch(`/api/admin/member-reports/${id}`, body)
      setNoting(null)
      setNote('')
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(null)
    }
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
        Nothing reported. Long may it last.
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
          const Icon = CATEGORY_ICON[r.category]
          const safety = r.category === 'safety'
          return (
            <li
              key={r.id}
              className="flex flex-col gap-4 rounded-card border-[length:var(--bw)] bg-surface px-5 py-[18px] sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-start"
              style={{
                borderColor: safety && r.status !== 'resolved' ? 'var(--bad)' : 'var(--line)',
                boxShadow: 'var(--e1)',
              }}
            >
              <span
                aria-hidden="true"
                className="grid h-[46px] w-[46px] place-items-center rounded-[14px] text-ink"
                style={{ background: safety ? 'var(--tbad)' : 'var(--surface2)' }}
              >
                <Icon size={24} weight="duotone" />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-ink">
                    {CATEGORY[r.category]} · {r.subject_label}
                  </p>
                  <span className="admin-tag py-[3px]" style={{ background: STATUS[r.status].tint }}>
                    {STATUS[r.status].label}
                  </span>
                </div>

                <p className="mt-1 text-sm text-muted">
                  {/* The reporter's name reaches an ADMIN and nobody else. It is
                      on this row because an admin who has to follow something up
                      needs to know who to ask — and "OK to contact" is what says
                      whether they may. */}
                  From {r.reporter_name ?? 'a member'} · {formatRelativeTime(r.created_at)}
                  {r.ok_to_contact && ' · OK to contact'}
                </p>

                <p className="mt-2.5 text-[15px] leading-[1.55] text-ink">{r.body}</p>

                {r.note_to_reporter && (
                  <p className="mt-2 rounded-[14px] bg-sunken px-4 py-2 text-sm text-muted">
                    <strong className="font-bold text-ink">Sent back:</strong> {r.note_to_reporter}
                  </p>
                )}

                {noting === r.id && (
                  <div className="mt-3 flex flex-col gap-2">
                    <label>
                      <span className="mb-1.5 block text-sm font-bold text-ink">
                        Note to the reporter
                      </span>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="field"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === r.id || !note.trim()}
                        onClick={() => patch(r.id, { note_to_reporter: note.trim() })}
                        className="btn btn-primary btn-md"
                      >
                        Send it
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoting(null)
                          setNote('')
                        }}
                        className="btn btn-quiet btn-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex min-w-[150px] flex-col gap-2">
                {r.status === 'new' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => patch(r.id, { status: 'looking' })}
                    className="btn btn-primary btn-md"
                  >
                    Start looking
                  </button>
                )}
                {r.status === 'looking' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => patch(r.id, { status: 'resolved' })}
                    className="btn btn-ok btn-md"
                  >
                    <Check size={16} weight="bold" aria-hidden="true" />
                    Resolve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNoting(r.id)
                    setNote(r.note_to_reporter ?? '')
                  }}
                  className="btn btn-quiet btn-md text-[13px]"
                >
                  <ChatCircleDots size={16} aria-hidden="true" />
                  Note to reporter
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
