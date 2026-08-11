'use client'
import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ToyStep, ToyStepId, ToyStepStatus } from '@/lib/toy-steps'

const STATUS_GLYPH: Record<ToyStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export function ToyEditStepper({ steps }: { steps: ToyStep[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stepIds = steps.map((s) => s.id)
  const requested = searchParams.get('step') as ToyStepId | null
  const [activeId, setActiveId] = useState<ToyStepId>(
    requested && stepIds.includes(requested) ? requested : steps[0].id
  )

  function selectStep(id: ToyStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}` as Route<string>, { scroll: false })
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="step-pill-row" role="tablist" aria-label="Toy sections">
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
    </div>
  )
}
