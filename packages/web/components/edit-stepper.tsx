'use client'
/**
 * Free-jump step navigator for the edit-tutorial page: a pill row (one per
 * section, each carrying a status dot) and the active section's content. The
 * active step persists in ?step= so a refresh or shared link lands back on the
 * same section.
 *
 * Finishing lives here rather than in the Review step. It used to sit inside
 * TutorialReviewPanel, which meant every step but Review never mentioned that
 * submitting existed — you could fill in every field and never learn there was
 * a finish line. The bar follows you now, everywhere it has something to say:
 * the free jump is unchanged, the pill row is still the way around, and this
 * only adds a way to the end. The one exception is a step marked trailing,
 * which is not on the walk at all — see EditStep.trailing.
 *
 * The bar stays a sibling of the panel rather than moving inside it: .panel
 * sets overflow:hidden for its corners, which would kill position:sticky.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { EditStep, EditStepId, EditStepStatus, MissingStep } from '@/lib/edit-steps'
import { ToastProvider, useToast } from '@/components/toast'
import { FinishBar } from '@/components/finish-bar'
import {
  NextStepProvider,
  StepJumpProvider,
  SaveOnLeaveProvider,
  type PendingSave,
} from '@/components/panel-actions'
import type { ReactNode } from 'react'

const STATUS_GLYPH: Record<EditStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export interface EditFinish {
  missing: MissingStep[]
  submitLabel: string
  busyLabel: string
  errorMessage: string
  onSubmit: () => Promise<void>
  /** Set once the tutorial has left the contributor's hands. */
  done?: ReactNode
}

/**
 * Announces the create, which the redirect out of /upload cannot do for
 * itself. NewTutorialForm lands on ?step=files&created=1; both pages draw the
 * same pills and the same panel, so without this the handover reads as being
 * thrown somewhere else rather than as a step completed.
 *
 * Its own component because useToast() only works below ToastProvider, and
 * this file is where that provider is mounted.
 */
function CreatedToast({ onClear }: { onClear: () => void }) {
  const showToast = useToast()
  const created = useSearchParams().get('created')

  useEffect(() => {
    if (!created) return
    showToast('Tutorial created. Add the guide and a photo next.')
    // Dropped from the URL so a refresh does not announce it a second time.
    onClear()
  }, [created, showToast, onClear])

  return null
}

export function EditStepper({ steps, finish }: { steps: EditStep[]; finish?: EditFinish }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stepIds = steps.map((s) => s.id)
  const requested = searchParams.get('step') as EditStepId | null
  const [activeId, setActiveId] = useState<EditStepId>(
    requested && stepIds.includes(requested) && !steps.find((s) => s.id === requested)?.disabled
      ? requested
      : steps[0].id
  )

  /*
   * Every way out of a step runs through here — Next, a pill, a gap chip in the
   * finish bar — which is why the open panel's save hangs off it rather than
   * off the Next button. Hanging it off Next would have meant losing what you
   * typed or not, depending on which control you happened to reach for.
   *
   * With nothing outstanding this stays exactly what it was: a synchronous
   * setState, no tick of delay on a pill click. The panel parks a function only
   * while it is holding something the server has not got.
   *
   * A panel that cannot save says so by returning false, and then nobody
   * moves: it is already showing the failure, and leaving would discard the
   * edit that caused it.
   */
  const pendingSave = useRef<(() => Promise<boolean>) | null>(null)
  const [leaving, setLeaving] = useState(false)

  function go(id: EditStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  function selectStep(id: EditStepId) {
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

  /*
   * The step after this one, and nothing cleverer than that.
   *
   * It used to scan forward for the next step carrying 'attention' and fall
   * back to the last, so that a contributor was never marched through a step
   * with nothing wrong with it. What that actually did was skip the optional
   * ones: finish Tools and Next read "Review and submit", jumping STL Files
   * entirely. Optional means you may leave it empty, not that you should never
   * be shown it — and a walk that silently drops steps teaches you that the
   * button cannot be trusted to know where you are.
   *
   * Going back to a gap is the finish bar's job; its chips name each one and
   * open it. Next only ever means onward, which is the one thing an arrow can
   * honestly promise.
   *
   * Trailing steps are not on the walk at all, so they are neither somewhere
   * Next sends you nor the end it stops at.
   */
  const walk = steps.filter((s) => !s.trailing)
  const last = walk[walk.length - 1]
  const after = walk.slice(walk.findIndex((s) => s.id === activeId) + 1)
  const nextStep = after.find((s) => !s.disabled)

  return (
    <ToastProvider>
      <CreatedToast
        onClear={() =>
          router.replace(`${pathname}?step=${activeId}` as Route<string>, { scroll: false })
        }
      />

      <div className="step-pill-row" role="tablist" aria-label="Tutorial sections">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={step.id === activeId}
            data-active={step.id === activeId || undefined}
            disabled={step.disabled}
            onClick={() => selectStep(step.id)}
            className={
              step.trailing ? 'step-pill step-pill-accent ml-auto' : 'step-pill'
            }
          >
            {/* No dot on a trailing pill: the dot says how far along the walk
                you are, and a stop beside the walk has no answer to that. */}
            {!step.trailing && (
              <>
                <span className="step-pill-dot" data-status={step.status} aria-hidden="true">
                  {STATUS_GLYPH[step.status]}
                </span>{' '}
              </>
            )}
            {step.label}
          </button>
        ))}
      </div>

      {/* Next reaches the foot of the open panel through context, because the
          panel's markup belongs to the page rather than to this component. See
          panel-actions.tsx. */}
      <div role="tabpanel">
        <NextStepProvider
          value={
            finish && nextStep && !active.trailing ? (
              <button
                type="button"
                onClick={() => selectStep(nextStep.id)}
                className="btn btn-quiet btn-sm"
              >
                {nextStep.id === last.id && finish.missing.length === 0
                  ? 'Review and submit →'
                  : `Next: ${nextStep.label} →`}
              </button>
            ) : null
          }
        >
          <StepJumpProvider value={(step) => selectStep(step as EditStepId)}>
            <SaveOnLeaveProvider value={pendingSave as PendingSave}>
              {active.content}
            </SaveOnLeaveProvider>
          </StepJumpProvider>
        </NextStepProvider>
      </div>

      {/* A trailing step holds nothing that could be missing and nothing that
          submitting would carry, so the bar stays away rather than asking a
          contributor what it is for. See EditStep.trailing. */}
      {finish && !active.trailing && (
        <FinishBar
          missing={finish.missing}
          submitLabel={finish.submitLabel}
          busyLabel={finish.busyLabel}
          errorMessage={finish.errorMessage}
          onSubmit={finish.onSubmit}
          onJump={(step) => selectStep(step as EditStepId)}
          done={finish.done}
        />
      )}
    </ToastProvider>
  )
}
