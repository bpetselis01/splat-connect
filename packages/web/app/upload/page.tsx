/**
 * New Tutorial Page
 *
 * Was a six-step wizard that collected details, files, parts, tools, STL files
 * and a submission, mirroring the whole thing into sessionStorage so a reload
 * did not cost the user six steps of typing.
 *
 * Every one of those steps already exists as a step on the edit page, so the
 * wizard was a second implementation of each, kept in sync by hand. This page
 * now does only what the edit page cannot: bring the row into existence. The
 * rest of the journey is visible as locked pills, then the editor takes over.
 *
 * No contributor-terms gate here, unlike the wizard, which asked at step 6.
 * middleware.ts redirects /upload to /onboarding/contributor-terms before this
 * renders, and POST /api/tutorials refuses without them — a third check in the
 * page could only ever disagree with those two.
 *
 * The route stays /upload — it is what the dashboard, the nav, the middleware
 * and the e2e suites all point at, and renaming it buys nothing visible.
 *
 * Related files:
 * - components/new-tutorial-form.tsx: creates the draft and redirects
 * - app/tutorials/[id]/edit/page.tsx: every step after this one
 */
import { BackLink } from '@/components/back-link'
import { Suspense } from 'react'
import { EditStepper } from '@/components/edit-stepper'
import { NewTutorialForm } from '@/components/new-tutorial-form'
import type { EditStep } from '@/lib/edit-steps'

/** The steps the editor owns. Listed so the journey reads end to end, locked
 *  because each one needs an id to save against. */
const LOCKED: { id: EditStep['id']; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'parts', label: 'Parts' },
  { id: 'tools', label: 'Tools' },
  { id: 'stl', label: 'STL Files' },
  { id: 'backing', label: 'Backing' },
  { id: 'collaborators', label: 'Collaborators' },
  { id: 'review', label: 'Review' },
]

export default function NewTutorialPage() {
  const steps: EditStep[] = [
    {
      id: 'details',
      label: 'Details',
      status: 'attention',
      content: (
        <div className="panel pt-5">
          <div className="px-5 pb-5">
            <NewTutorialForm />
          </div>
        </div>
      ),
    },
    ...LOCKED.map((s) => ({ ...s, status: 'neutral' as const, disabled: true, content: null })),
  ]

  return (
    <div>
      <BackLink href="/dashboard/tutorials" label="My tutorials" />
      <h1 className="mb-2 title-article">New tutorial</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Name it now — the guide, parts, tools and everything else come next.
      </p>
      {/* useSearchParams() inside EditStepper requires a Suspense boundary, or
          `next build` fails to prerender this page. */}
      <Suspense>
        <EditStepper steps={steps} />
      </Suspense>
    </div>
  )
}
