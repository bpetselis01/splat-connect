'use client'
/**
 * The pieces of the board's editor shell that are not the rail itself: the
 * header above it and the parts of the Status section. Shared by the tutorial
 * and toy editors, which the board draws as one shape with different words.
 *
 * Client only because the checklist's "Fill it in" and the submit button need
 * the stepper's jump and a pending state; everything else here is plain markup.
 */
import { useState, type ReactNode } from 'react'
import { CheckCircle, CircleDashed } from '@phosphor-icons/react/dist/ssr'
import { useStepJump } from '@/components/panel-actions'
import { STAGE, type StageKey } from '@/components/stage'

export function EditorHeader({
  stage,
  stageLabel,
  extraPill,
  meta,
  title,
  actions,
}: {
  stage: StageKey
  stageLabel?: string
  extraPill?: ReactNode
  meta?: string
  title: string
  actions?: ReactNode
}) {
  const s = STAGE[stage]
  return (
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="editor-head__pill" style={{ background: s.tint }}>
            <s.Icon weight="fill" aria-hidden="true" />
            {stageLabel ?? s.label}
          </span>
          {extraPill}
          {meta && <span className="text-[13px] font-bold text-muted">{meta}</span>}
        </span>
        <h1 className="editor-head__title">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  )
}

export function StatusCard({ stage, head, body }: { stage: StageKey; head: string; body: ReactNode }) {
  const s = STAGE[stage]
  return (
    <div className="editor-status" style={{ background: s.tint }}>
      <span aria-hidden="true" className="editor-status__glyph">
        <s.Icon weight="duotone" size={30} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[22px] font-extrabold">{head}</p>
        <div className="mt-1.5 max-w-[62ch] text-[15px] leading-[1.6]">{body}</div>
      </div>
    </div>
  )
}

export type ChecklistRow = { step: string; label: string; note: string; done: boolean }

/** "What is left before you can submit": one row per section, with a jump. */
export function EditorChecklist({ title, sub, rows }: { title: string; sub: string; rows: ChecklistRow[] }) {
  const jump = useStepJump()
  return (
    <div>
      <h3 className="editor-h3">{title}</h3>
      <p className="mb-3.5 text-sm text-muted">{sub}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.step} className="editor-check">
            {r.done ? (
              <CheckCircle weight="fill" size={22} className="flex-none text-success" aria-label="Done" />
            ) : (
              <CircleDashed weight="fill" size={22} className="flex-none text-muted" aria-label="Not done" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold">{r.label}</span>
              <span className="block text-[13px] text-muted">{r.note}</span>
            </span>
            {!r.done && jump && (
              <button type="button" onClick={() => jump(r.step)} className="btn btn-quiet btn-sm flex-none">
                Fill it in
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export type HistoryRow = { icon: ReactNode; t: string; d: string; now?: boolean }

export function EditorHistory({ rows }: { rows: HistoryRow[] }) {
  return (
    <div>
      <h3 className="editor-h3 mb-3.5">History</h3>
      <ol className="flex flex-col gap-0.5">
        {rows.map((e, i) => (
          <li key={e.t} className="flex items-start gap-3.5">
            <span className="flex flex-none flex-col items-center gap-0.5 self-stretch">
              <span
                aria-hidden="true"
                className="grid h-[30px] w-[30px] place-items-center rounded-full text-[15px] text-ink"
                style={{ background: e.now ? 'var(--b100)' : 'var(--surface2)' }}
              >
                {e.icon}
              </span>
              {i < rows.length - 1 && (
                <span aria-hidden="true" className="min-h-[18px] w-0.5 flex-1 bg-line" />
              )}
            </span>
            <span className="min-w-0 pb-4">
              <span className="block text-[15px] font-extrabold">{e.t}</span>
              <span className="block text-sm leading-normal text-muted">{e.d}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The primary action, run as a server action, with its own pending and error. */
export function SubmitButton({
  label,
  busyLabel,
  errorMessage,
  onSubmit,
  disabled,
  icon,
  size = 'lg',
}: {
  label: string
  busyLabel: string
  errorMessage: string
  onSubmit: () => Promise<void>
  disabled?: boolean
  icon?: ReactNode
  /** The header's is the board's 48px; the Status section's is 52px. */
  size?: 'md' | 'lg'
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    setBusy(true)
    setError(null)
    try {
      await onSubmit()
    } catch {
      setError(errorMessage)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy}
        className={`btn btn-primary ${size === 'md' ? 'min-h-12 text-[15px]' : ''}`}
      >
        {icon}
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p role="alert" className="alert alert-danger basis-full">
          {error}
        </p>
      )}
    </>
  )
}
