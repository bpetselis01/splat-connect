'use client'
/**
 * The only client component that talks to the child-profiles API. Unlike
 * ToyEditor, no step is locked: every child-profile field is a plain column
 * with no upload/id dependency, so whichever pill is saved first creates the
 * profile and the URL silently swaps from /dashboard/child/new to
 * /dashboard/child/{id}.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import type { ChildProfile } from '@splat-connect/types'
import { ChildEditStepper } from '@/components/child-edit-stepper'
import { ChildSurveyForm } from '@/components/child-survey-form'
import { ChildAbilityForm } from '@/components/child-ability-form'
import { ChildEverydayNeedsForm } from '@/components/child-everyday-needs-form'
import { ChildCustomizationForm } from '@/components/child-customization-form'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { browserApiClient } from '@/lib/browser-api-client'
import { computeChildStepStatuses } from '@/lib/child-steps'

export function ChildEditor({ child: initialChild, label }: { child: ChildProfile | null; label?: string }) {
  const router = useRouter()
  const [child, setChild] = useState<ChildProfile | null>(initialChild)

  async function saveStep(fields: Partial<ChildProfile>) {
    if (!child) {
      const created = await browserApiClient.post<ChildProfile>('/api/child-profiles', fields)
      setChild(created)
      router.replace(`/dashboard/child/${created.id}` as Route<string>)
    } else {
      const updated = await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, fields)
      setChild(updated)
    }
  }

  const statuses = computeChildStepStatuses(child)
  const heading = child?.name?.trim() || label || 'Add child'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">{heading}</h1>
      <ChildEditStepper
        steps={[
          {
            id: 'survey',
            label: 'Survey',
            status: statuses.survey,
            content: (
              <div className="panel pt-5">
                <ChildSurveyForm profile={child} onSave={saveStep} />
              </div>
            ),
          },
          {
            id: 'ability',
            label: 'Ability',
            status: statuses.ability,
            content: (
              <div className="panel pt-5">
                <ChildAbilityForm profile={child} onSave={saveStep} />
              </div>
            ),
          },
          {
            id: 'everyday-needs',
            label: 'Everyday needs',
            status: statuses['everyday-needs'],
            content: (
              <div className="panel pt-5">
                <ChildEverydayNeedsForm profile={child} onSave={saveStep} />
              </div>
            ),
          },
          {
            id: 'customization',
            label: 'Customization',
            status: statuses.customization,
            content: (
              <div className="panel pt-5">
                <ChildCustomizationForm profile={child} onSave={saveStep} />
              </div>
            ),
          },
        ]}
        trailing={
          child && (
            <DeleteEntityButton
              endpoint={`/api/child-profiles/${child.id}`}
              redirectTo={'/dashboard/profile' as Route<string>}
              label={heading}
              className="step-pill step-pill-danger"
            />
          )
        }
      />
    </div>
  )
}
