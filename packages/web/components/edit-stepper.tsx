'use client'
/**
 * Free-jump step navigator for the edit-tutorial page: a pill row (one per
 * section, each carrying a status dot) and the active section's content. The
 * active step persists in ?step= so a refresh or shared link lands back on the
 * same section.
 *
 * Submission is no longer here. It lives in the Review step's own panel, as it
 * does on the toy editor, so the two features present the same shape.
 */
import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { EditStep, EditStepId, EditStepStatus } from '@/lib/edit-steps'
import { ToastProvider } from '@/components/toast'

const STATUS_GLYPH: Record<EditStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export function EditStepper({ steps }: { steps: EditStep[] }) {
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

      <div role="tabpanel">{active.content}</div>
    </ToastProvider>
  )
}
