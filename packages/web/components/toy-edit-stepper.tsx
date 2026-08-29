'use client'
import { useRef, useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { MissingToyStep, ToyStep, ToyStepId, ToyStepStatus } from '@/lib/toy-steps'
import { FinishBar } from '@/components/finish-bar'
import {
  NextStepProvider,
  SaveOnLeaveProvider,
  type PendingSave,
} from '@/components/panel-actions'

const STATUS_GLYPH: Record<ToyStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

/**
 * `trailing` is an escape hatch for row-level actions that are not steps — the
 * edit page hangs Delete toy off it. It sits outside the tablist on purpose:
 * a tablist's children are meant to be tabs, and a delete button announced as
 * "tab 4 of 4" would be a lie.
 *
 * `finish` is the publish bar, which used to be rendered by ToyReviewPanel and
 * so only existed on the Review step. Same gap the tutorial editor had, same
 * answer: it follows you, and it keeps the toy's own verb.
 */
export interface ToyFinish {
  missing: MissingToyStep[]
  onPublish: () => Promise<void>
  /** Set once the toy is published — there is nothing left to do. */
  done?: ReactNode
}

export function ToyEditStepper({
  steps,
  trailing,
  finish,
}: {
  steps: ToyStep[]
  trailing?: ReactNode
  finish?: ToyFinish
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get('step') as ToyStepId | null
  const [activeId, setActiveId] = useState<ToyStepId>(
    steps.find((s) => s.id === requested && !s.disabled)?.id ?? steps[0].id
  )

  // The open panel's save, run before any step change. Same arrangement as the
  // tutorial stepper, and see its note for why it hangs off selectStep rather
  // than off the Next button, and why the no-op case stays synchronous.
  const pendingSave = useRef<(() => Promise<boolean>) | null>(null)
  const [leaving, setLeaving] = useState(false)

  function go(id: ToyStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  function selectStep(id: ToyStepId) {
    const save = pendingSave.current
    if (!save) return go(id)
    if (leaving) return
    setLeaving(true)
    void save()
      .then((saved) => {
        if (saved) go(id)
      })
      .finally(() => setLeaving(false))
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  // The step after this one — the same rule the tutorial stepper runs, and see
  // its note for why Next walks in order rather than hunting the next gap.
  const last = steps[steps.length - 1]
  const after = steps.slice(steps.findIndex((s) => s.id === activeId) + 1)
  const nextStep = after.find((s) => !s.disabled)

  return (
    <>
      <div className="step-pill-row">
        {/* display:contents, so the pills stay direct flex children of the row
            and keep today's gap and horizontal scrolling. Splitting the row
            into two real boxes would mean editing .step-pill-row, which
            edit-stepper.tsx also uses. */}
        <div role="tablist" aria-label="Toy sections" className="contents">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={step.id === activeId}
              data-active={step.id === activeId || undefined}
              disabled={step.disabled}
              onClick={() => selectStep(step.id)}
              className="step-pill"
            >
              <span className="step-pill-dot" data-status={step.status} aria-hidden="true">
                {STATUS_GLYPH[step.status]}
              </span>{' '}
              {step.label}
            </button>
          ))}
        </div>
        {trailing && <div className="ml-auto pl-2">{trailing}</div>}
      </div>

      <div role="tabpanel">
        <NextStepProvider
          value={
            finish && nextStep ? (
              <button
                type="button"
                onClick={() => selectStep(nextStep.id)}
                className="btn btn-quiet btn-sm"
              >
                {nextStep.id === last.id && finish.missing.length === 0
                  ? 'Review and publish →'
                  : `Next: ${nextStep.label} →`}
              </button>
            ) : null
          }
        >
          <SaveOnLeaveProvider value={pendingSave as PendingSave}>
            {active.content}
          </SaveOnLeaveProvider>
        </NextStepProvider>
      </div>

      {finish && (
        <FinishBar
          missing={finish.missing}
          submitLabel="Publish"
          busyLabel="Publishing…"
          errorMessage="Could not publish this toy. Please try again."
          onSubmit={finish.onPublish}
          onJump={(step) => selectStep(step as ToyStepId)}
          done={finish.done}
        />
      )}
    </>
  )
}
