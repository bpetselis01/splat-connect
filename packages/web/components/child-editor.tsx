'use client'
/**
 * The only client component that talks to the child-profiles API. Unlike
 * ToyEditor, no step is locked: every child-profile field is a plain column
 * with no upload/id dependency, so whichever pill is saved first creates the
 * profile and the URL silently swaps from /dashboard/child/new to
 * /dashboard/child/{id}.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import type { ChildProfile } from '@splat-connect/types'
import { ChildSurveyForm } from '@/components/child-survey-form'
import { ChildAbilityForm } from '@/components/child-ability-form'
import { ChildEverydayNeedsForm } from '@/components/child-everyday-needs-form'
import { ChildCustomizationForm } from '@/components/child-customization-form'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { browserApiClient } from '@/lib/browser-api-client'
import { NotMedicalNote } from '@/components/not-medical-note'

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

  const heading = child?.name?.trim() || label || 'Add a child'

  // The board draws this as one page of stacked cards, not a stepper: a child
  // profile is never submitted, so there is no order to walk and nothing to
  // gate. Each card keeps its own save — the section forms are shared with the
  // onboarding wizard, and the survey only saves once every question is
  // answered, so one page-level save would have to know both rules.
  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    { id: 'basics', title: 'Basics', body: <ChildAbilityForm profile={child} onSave={saveStep} /> },
    { id: 'ability', title: 'Ability profile', body: <ChildSurveyForm profile={child} onSave={saveStep} /> },
    { id: 'everyday-needs', title: 'Everyday needs', body: <ChildEverydayNeedsForm profile={child} onSave={saveStep} /> },
    { id: 'customization', title: 'Customization', body: <ChildCustomizationForm profile={child} onSave={saveStep} /> },
  ]

  return (
    <section className="max-w-[760px]">
      <p className="eyebrow text-muted">Private to you</p>
      <h1 className="title-hub mt-2">{heading}</h1>
      <p className="mt-2.5 max-w-[56ch] text-base leading-relaxed text-muted">
        Every field is optional. We use this only to suggest guides that suit your
        child — it is never shown to another person, contributor or organisation.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <p className="text-xs leading-relaxed text-muted">
          See the <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
        <NotMedicalNote />
      </div>

      <div className="mt-[26px] flex flex-col gap-4">
        {sections.map((s) => (
          <section
            key={s.id}
            aria-labelledby={`child-${s.id}`}
            className="rounded-card border border-line bg-surface px-1.5 pb-1.5 pt-[26px] shadow-e2"
          >
            <h2 id={`child-${s.id}`} className="mb-3 px-5 text-xl font-extrabold text-ink">
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </div>

      {child && (
        <div className="mt-6">
          <DeleteEntityButton
            endpoint={`/api/child-profiles/${child.id}`}
            redirectTo={'/dashboard/profile' as Route<string>}
            label={heading}
          />
        </div>
      )}
    </section>
  )
}
