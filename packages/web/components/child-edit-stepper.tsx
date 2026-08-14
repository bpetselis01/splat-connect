'use client'
/**
 * Same pill-row shape as toy-edit-stepper.tsx, minus `disabled` handling —
 * no child-profile step is ever locked, since every field is a plain column
 * with no upload/id dependency. A separate file rather than a shared
 * generic, matching the existing precedent that toy-edit-stepper.tsx and
 * edit-stepper.tsx are already two near-identical components.
 */
import { useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ChildStep, ChildStepId, ChildStepStatus } from '@/lib/child-steps'

const STATUS_GLYPH: Record<ChildStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export function ChildEditStepper({ steps, trailing }: { steps: ChildStep[]; trailing?: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get('step') as ChildStepId | null
  const [activeId, setActiveId] = useState<ChildStepId>(
    steps.find((s) => s.id === requested)?.id ?? steps[0].id
  )

  function selectStep(id: ChildStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  return (
    <>
      <div className="step-pill-row">
        <div role="tablist" aria-label="Child profile sections" className="contents">
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
        {trailing && <div className="ml-auto pl-2">{trailing}</div>}
      </div>

      <div role="tabpanel">{active.content}</div>
    </>
  )
}
