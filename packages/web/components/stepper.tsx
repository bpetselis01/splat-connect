'use client'
/**
 * Free-jump step navigator for the three editors: a pill row (one per section,
 * each carrying a status dot) and the active section's content. The active step
 * persists in ?step= so a refresh or shared link lands back on the same
 * section.
 *
 * One component for tutorials, toys and child profiles. It was three files
 * until 2026-08-30 — same pill row, same ?step= sync, same save-before-leaving
 * rule, same Next, same finish bar — and the only things that actually differed
 * are props now: the tablist's name, whether there is anything to finish, and
 * an optional row-level action.
 *
 * Finishing lives here rather than in the Review step. It used to sit inside
 * TutorialReviewPanel and ToyReviewPanel, which meant every step but Review
 * never mentioned that submitting existed — you could fill in every field and
 * never learn there was a finish line. The bar follows you now, everywhere it
 * has something to say: the free jump is unchanged, the pill row is still the
 * way around, and this only adds a way to the end. The one exception is a step
 * marked offWalk, which is not on the walk at all — see Step.offWalk.
 *
 * The bar stays a sibling of the panel rather than moving inside it: .panel
 * sets overflow:hidden for its corners, which would kill position:sticky.
 */
import { useRef, useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { Gap, Step, StepStatus } from '@/lib/steps'
import { FinishBar } from '@/components/finish-bar'
import {
  NextStepProvider,
  StepJumpProvider,
  SaveOnLeaveProvider,
  type PendingSave,
} from '@/components/panel-actions'

const STATUS_GLYPH: Record<StepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export interface Finish<Id extends string> {
  missing: Gap<Id>[]
  /** Names the action, so each editor supplies its own verb: a tutorial is
   *  submitted for review, a toy is published, and neither borrows the other's. */
  submitLabel: string
  busyLabel: string
  errorMessage: string
  /** What Next reads on the step before the end once nothing is missing —
   *  "Review and submit", "Review and publish". */
  endLabel: string
  onSubmit: () => Promise<void>
  /** Set once the draft has left its owner's hands: the last-saved line for a
   *  tutorial, a "Published" note for a toy. */
  done?: ReactNode
}

export function Stepper<Id extends string>({
  steps,
  label,
  trailing,
  finish,
}: {
  steps: Step<Id>[]
  /** Names the tablist: "Tutorial sections", "Toy sections". */
  label: string
  /**
   * A row-level action that is not a step — the toy and child editors hang
   * Delete off it. It sits outside the tablist on purpose: a tablist's children
   * are meant to be tabs, and a delete button announced as "tab 4 of 4" would
   * be a lie. Distinct from Step.offWalk, which is a real step parked beside
   * the walk.
   */
  trailing?: ReactNode
  finish?: Finish<Id>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get('step') as Id | null
  const [activeId, setActiveId] = useState<Id>(
    steps.find((s) => s.id === requested && !s.disabled)?.id ?? steps[0].id
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

  function go(id: Id) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  function selectStep(id: Id) {
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
   * Off-walk steps are not on the walk at all, so they are neither somewhere
   * Next sends you nor the end it stops at. Disabled ones are stepped over:
   * /upload draws the whole journey locked, and a Next pointing at one would be
   * a button that does nothing.
   */
  const walk = steps.filter((s) => !s.offWalk)
  const last = walk[walk.length - 1]
  const after = walk.slice(walk.findIndex((s) => s.id === activeId) + 1)
  const nextStep = after.find((s) => !s.disabled)

  return (
    <>
      <div className="step-pill-row">
        {/* display:contents, so the pills stay direct flex children of the row
            and keep today's gap and horizontal scrolling. Splitting the row
            into two real boxes would mean editing .step-pill-row, which is
            also the frame of every editor. */}
        <div role="tablist" aria-label={label} className="contents">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={step.id === activeId}
              data-active={step.id === activeId || undefined}
              disabled={step.disabled}
              onClick={() => selectStep(step.id)}
              className={step.offWalk ? 'step-pill step-pill-accent ml-auto' : 'step-pill'}
            >
              {/* No dot on an off-walk pill: the dot says how far along the walk
                  you are, and a stop beside the walk has no answer to that. */}
              {!step.offWalk && (
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
        {trailing && <div className="ml-auto pl-2">{trailing}</div>}
      </div>

      {/* Next reaches the foot of the open panel through context, because the
          panel's markup belongs to the page rather than to this component. See
          panel-actions.tsx. */}
      <div role="tabpanel">
        <NextStepProvider
          value={
            nextStep && !active.offWalk ? (
              <button
                type="button"
                onClick={() => selectStep(nextStep.id)}
                className="btn btn-quiet btn-sm"
              >
                {finish && nextStep.id === last.id && finish.missing.length === 0
                  ? `${finish.endLabel} →`
                  : `Next: ${nextStep.label} →`}
              </button>
            ) : null
          }
        >
          <StepJumpProvider value={(step) => selectStep(step as Id)}>
            <SaveOnLeaveProvider value={pendingSave as PendingSave}>
              {active.content}
            </SaveOnLeaveProvider>
          </StepJumpProvider>
        </NextStepProvider>
      </div>

      {/* An off-walk step holds nothing that could be missing and nothing that
          submitting would carry, so the bar stays away rather than asking what
          it is for. See Step.offWalk. */}
      {finish && !active.offWalk && (
        <FinishBar
          missing={finish.missing}
          submitLabel={finish.submitLabel}
          busyLabel={finish.busyLabel}
          errorMessage={finish.errorMessage}
          onSubmit={finish.onSubmit}
          onJump={(step) => selectStep(step as Id)}
          done={finish.done}
        />
      )}
    </>
  )
}
