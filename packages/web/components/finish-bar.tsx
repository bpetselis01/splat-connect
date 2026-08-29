'use client'
/**
 * The bar that says how far a draft is from being finished, and finishes it.
 *
 * It used to live inside TutorialReviewPanel and ToyReviewPanel, which meant
 * it only existed while you were standing on the Review step — so seven of the
 * tutorial editor's eight steps, and two of the toy editor's three, said
 * nothing about how much was left or that submitting was a thing that
 * happened. A contributor could fill in every field and never learn there was
 * a finish line. It is rendered by the steppers now, so it follows you.
 *
 * One component for both editors because there is one behaviour: name the
 * gaps, offer a route to each, and hold the finishing action closed until
 * there are none. Only the words differ, which is what the props are for — a
 * tutorial is submitted for review, a toy is published, and neither control
 * borrows the other's verb.
 *
 * `done` is what replaces the action once the thing has been handed over: the
 * last-saved line for a tutorial, a "Published" note for a toy. It is rendered
 * bare rather than in the bar's own card: there is nothing left to act on, and
 * a bordered box with a shadow reads as a control that wants something.
 */
import { useState, type ReactNode } from 'react'
import type { Gap } from '@/lib/steps'

export function FinishBar({
  missing,
  submitLabel,
  busyLabel,
  errorMessage,
  onSubmit,
  onJump,
  done,
}: {
  missing: Gap[]
  submitLabel: string
  busyLabel: string
  /** Shown if onSubmit rejects. Names the action, so each editor supplies it. */
  errorMessage: string
  onSubmit: () => Promise<void>
  /** Opens the step that closes a gap. The stepper owns step selection. */
  onJump: (step: string) => void
  /** Rendered instead of the action once there is nothing left to do. */
  done?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
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

  if (done) {
    return <div className="mt-4">{done}</div>
  }

  return (
    <>
      {error && (
        <p role="alert" className="alert alert-danger mt-3">
          {error}
        </p>
      )}
      <div className="sticky-submit-bar">
        <span className="sticky-submit-note">
          {missing.length === 0 ? (
            <span className="font-bold text-mint-deep">Ready to {submitLabel.toLowerCase()}</span>
          ) : (
            <>
              <span className="font-bold text-ink">
                {missing.length} {missing.length === 1 ? 'thing' : 'things'} left
              </span>{' '}
              {/* Each gap is a control, not a label: the point is to name what
                  is missing and hand over the step that fixes it in the same
                  gesture. The pill row can still be used instead. */}
              {missing.map((m) => (
                <button
                  key={`${m.step}-${m.label}`}
                  type="button"
                  onClick={() => onJump(m.step)}
                  className="finish-gap"
                >
                  {m.label}
                </button>
              ))}
            </>
          )}
        </span>
        <button
          type="button"
          disabled={missing.length > 0 || busy}
          onClick={submit}
          className="btn btn-accent"
        >
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </>
  )
}
