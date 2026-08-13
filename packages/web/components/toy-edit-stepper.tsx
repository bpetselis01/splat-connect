'use client'
import { useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ToyStep, ToyStepId, ToyStepStatus } from '@/lib/toy-steps'

const STATUS_GLYPH: Record<ToyStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

/**
 * `trailing` is an escape hatch for row-level actions that are not steps — the
 * edit page hangs Delete toy off it. It sits outside the tablist on purpose:
 * a tablist's children are meant to be tabs, and a delete button announced as
 * "tab 4 of 4" would be a lie.
 */
export function ToyEditStepper({ steps, trailing }: { steps: ToyStep[]; trailing?: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get('step') as ToyStepId | null
  const [activeId, setActiveId] = useState<ToyStepId>(
    steps.find((s) => s.id === requested && !s.disabled)?.id ?? steps[0].id
  )

  function selectStep(id: ToyStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

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

      <div role="tabpanel">{active.content}</div>
    </>
  )
}
