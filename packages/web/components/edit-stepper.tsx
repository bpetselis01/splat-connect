'use client'
/**
 * Free-jump step navigator for the edit-tutorial page: a pill row (one per
 * section, each carrying a status dot), the active section's content, and a
 * sticky bottom bar for Submit. The active step persists in ?step= so a
 * refresh or shared link lands back on the same section.
 */
import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { TutorialStatus } from '@splat-connect/types'
import type { EditStep, EditStepId, EditStepStatus } from '@/lib/edit-steps'
import { ToastProvider } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

const STATUS_GLYPH: Record<EditStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export function EditStepper({
  steps,
  tutorialStatus,
  tutorialUpdatedAt,
  missingFields,
  onSubmit,
}: {
  steps: EditStep[]
  tutorialStatus: TutorialStatus
  tutorialUpdatedAt: string
  missingFields: string[]
  onSubmit: () => Promise<void>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stepIds = steps.map((s) => s.id)
  const requested = searchParams.get('step') as EditStepId | null
  const [activeId, setActiveId] = useState<EditStepId>(
    requested && stepIds.includes(requested) ? requested : steps[0].id
  )
  const [submitting, setSubmitting] = useState(false)

  function selectStep(id: EditStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  return (
    <ToastProvider>
      <div className="step-pill-row" role="tablist" aria-label="Tutorial sections">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={step.id === activeId}
            data-active={step.id === activeId || undefined}
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

      <div role="tabpanel">{active.content}</div>

      {tutorialStatus === 'draft' ? (
        <div className="sticky-submit-bar">
          <span className="sticky-submit-note">
            {missingFields.length > 0
              ? `Add ${missingFields.join(', ')} to submit`
              : 'Ready to submit'}
          </span>
          <button
            type="button"
            disabled={missingFields.length > 0 || submitting}
            onClick={handleSubmit}
            className="btn btn-accent"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      ) : (
        <div className="sticky-submit-bar sticky-submit-bar-quiet">
          <SaveStatusLine savedAt={tutorialUpdatedAt} />
        </div>
      )}
    </ToastProvider>
  )
}
