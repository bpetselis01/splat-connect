'use client'
/**
 * Free-jump step navigator for the edit-tutorial page: a pill row (one per
 * section, each carrying a status dot) and the active section's content. The
 * active step persists in ?step= so a refresh or shared link lands back on the
 * same section.
 *
 * Finishing lives here rather than in the Review step. It used to sit inside
 * TutorialReviewPanel, which meant seven of the eight steps never mentioned
 * that submitting existed — you could fill in every field and never learn
 * there was a finish line. The bar follows you now, and the free jump is
 * unchanged: the pill row is still the way around, and this only adds a way
 * to the end.
 *
 * The bar stays a sibling of the panel rather than moving inside it: .panel
 * sets overflow:hidden for its corners, which would kill position:sticky.
 */
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { EditStep, EditStepId, EditStepStatus, MissingStep } from '@/lib/edit-steps'
import { ToastProvider, useToast } from '@/components/toast'
import { FinishBar } from '@/components/finish-bar'
import { NextStepProvider } from '@/components/panel-actions'
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

  function selectStep(id: EditStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  /*
   * The next step still wanting something, searched forward from where you are
   * — never simply the next in the list, and never one behind you.
   *
   * Forward matters: three of the eight steps are optional and never carry
   * 'attention', so scanning finds the step that needs work rather than
   * marching everyone through STL Files, Backing and Collaborators. But
   * scanning the whole list pointed Review back at Photos under a forward
   * arrow, which is a lie about where the button goes — and a duplicate of the
   * bar's own gap chip sitting inches below it. Falls back to the last step,
   * which is the summary worth reading before submitting, and to nothing at
   * all once you are standing on it.
   */
  const last = steps[steps.length - 1]
  const after = steps.slice(steps.findIndex((s) => s.id === activeId) + 1)
  const nextStep =
    after.find((s) => s.status === 'attention' && !s.disabled) ??
    (activeId !== last.id && !last.disabled ? last : undefined)

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
            className="step-pill"
          >
            <span className="step-pill-dot" data-status={step.status} aria-hidden="true">
              {STATUS_GLYPH[step.status]}
            </span>{' '}
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
            finish && nextStep ? (
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
          {active.content}
        </NextStepProvider>
      </div>

      {finish && (
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
