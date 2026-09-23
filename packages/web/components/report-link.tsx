'use client'
/**
 * The board's "Report this listing": a quiet link that opens "Tell SPLAT what
 * happened" and files a member report (POST /api/reports, 065). A signed-out
 * visitor is sent to sign in instead, as the board does — a report needs a
 * reporter. Dialog mechanics are delete-entity-button.tsx's native <dialog>.
 *
 * The board's optional photo is not built: member_reports has no column for it.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  ChatsTeardrop,
  DotsThreeCircle,
  FileX,
  Flag,
  PaperPlaneTilt,
  ShieldWarning,
  UserMinus,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

/** The board's six reasons, keyed by the API's categories. */
const REASONS = [
  { value: 'arrived_broken', label: 'Arrived broken', Icon: WarningCircle },
  { value: 'no_show', label: 'Didn’t show up', Icon: UserMinus },
  { value: 'safety', label: 'Safety concern', Icon: ShieldWarning },
  { value: 'wrong_info', label: 'Wrong or missing info', Icon: FileX },
  { value: 'conduct', label: 'Behaviour', Icon: ChatsTeardrop },
  { value: 'other', label: 'Something else', Icon: DotsThreeCircle },
] as const

export function ReportLink({
  subjectKind,
  subjectId,
  subjectLabel,
  who,
  signedIn,
}: {
  subjectKind: 'toy'
  subjectId: string
  subjectLabel: string
  who: string | null
  signedIn: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [contact, setContact] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function start() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    setReason(null)
    setText('')
    setContact(true)
    setError(null)
    setSent(null)
    setOpen(true)
  }

  async function submit() {
    if (!reason || !text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post('/api/reports', {
        subject_kind: subjectKind,
        subject_id: subjectId,
        subject_label: subjectLabel,
        category: reason,
        body: text,
        ok_to_contact: contact,
      })
      setSent(
        reason === 'safety'
          ? 'Sent. Safety reports go to the top of the queue — expect a reply today.'
          : 'Sent to SPLAT. You will hear back within two days.'
      )
    } catch {
      setError('Could not send that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-bold text-muted hover:text-ink"
      >
        <Flag aria-hidden="true" /> Report this listing
      </button>

      <dialog
        ref={ref}
        aria-labelledby="rep-h"
        className="dialog-panel w-[min(560px,100%)]"
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false)
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 flex-none place-items-center rounded-[18px] text-ink"
              style={{ background: 'var(--tamber)' }}
            >
              <Flag size={26} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="rep-h" className="m-0 font-display text-[26px] font-extrabold leading-[1.1] text-ink">
                Tell SPLAT what happened
              </h2>
              <p className="m-0 mt-1.5 text-sm leading-[1.5] text-muted">
                About <strong className="text-ink">{subjectLabel}</strong>
                {who && (
                  <>
                    {' '}· with <strong className="text-ink">{who}</strong>
                  </>
                )}
                . Goes to the SPLAT team only.
              </p>
            </div>
          </div>

          {sent ? (
            <>
              <p role="status" className="m-0 rounded-[18px] px-4 py-3.5 text-sm font-semibold text-ink" style={{ background: 'var(--tok)' }}>
                {sent}
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="eyebrow m-0 mb-2.5 text-muted">What happened?</p>
                <div role="radiogroup" aria-label="What happened?" className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={reason === r.value}
                      onClick={() => setReason(r.value)}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-extrabold text-ink ${
                        reason === r.value ? 'border-brand-dark bg-brand-50' : 'border-line bg-surface'
                      }`}
                    >
                      <r.Icon weight="bold" aria-hidden="true" className="text-brand-dark" />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-2">
                <span className="eyebrow text-muted">In your words</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="What you expected, what actually happened, and when."
                  className="field"
                />
              </label>

              <label className="flex items-start gap-3 rounded-[18px] border border-line p-3.5">
                <input
                  type="checkbox"
                  checked={contact}
                  onChange={(e) => setContact(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-extrabold text-ink">OK to contact me about this</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted">
                    Otherwise we act on it and you only see the outcome.
                  </span>
                </span>
              </label>

              <p className="m-0 rounded-[18px] bg-brand-tint px-4 py-3.5 text-sm leading-[1.55] text-ink">
                Read within two days; anything marked <strong>safety</strong> jumps the queue. The other person
                is never told who reported. Nothing here is public.
              </p>

              {error && (
                <p role="alert" className="alert alert-danger m-0">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2.5">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!reason || !text.trim() || busy}
                  className="btn btn-primary"
                >
                  <PaperPlaneTilt weight="bold" aria-hidden="true" />
                  {busy ? 'Sending…' : 'Send to SPLAT'}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  )
}
