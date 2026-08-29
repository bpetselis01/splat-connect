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
 * Since 2026-08-29 it asks one question first: which kind of tutorial. The two
 * kinds differ by a single step — an assistive-tech build has STL files, a
 * toy adaptation never does — and this is where that gets settled, with a
 * sentence under each card rather than a pill a toy contributor has to wonder
 * about. The choice is a link (?kind=…) so the page stays a server component
 * and a reload keeps it.
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
 * - lib/edit-steps.ts: stepsFor(), which both pages draw their pills from
 */
import Link from 'next/link'
import { BackLink } from '@/components/back-link'
import { Suspense } from 'react'
import { Stepper } from '@/components/stepper'
import { NewTutorialForm } from '@/components/new-tutorial-form'
import { stepsFor, type EditStep, type EditStepId } from '@/lib/edit-steps'
import { KIND_LABEL, type TutorialKind } from '@splat-connect/types'

/** Pill labels, the same words the editor uses. */
const LABELS: Record<EditStepId, string> = {
  details: 'Details',
  files: 'Files',
  parts: 'Parts',
  tools: 'Tools',
  stl: 'STL Files',
  review: 'Review',
  recommended: 'Recommended',
  team: 'Team',
}

const KINDS: { kind: TutorialKind; blurb: string }[] = [
  { kind: 'toy_adaptation', blurb: 'Switch-adapt a toy that already exists. A guide, a photo, the parts and the tools.' },
  { kind: 'assistive_tech', blurb: 'A build whose heart is a printed part. Everything a toy adaptation has, plus the STL files to print it.' },
]

function isKind(v: string | undefined): v is TutorialKind {
  return v === 'toy_adaptation' || v === 'assistive_tech'
}

export default async function NewTutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind } = await searchParams

  if (!isKind(kind)) {
    return (
      <div>
        <BackLink href="/dashboard/tutorials" label="My tutorials" />
        <h1 className="mb-2 title-article">New tutorial</h1>
        <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
          What are you writing up? This decides which steps you see.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {KINDS.map(({ kind, blurb }) => (
            <Link key={kind} href={`/upload?kind=${kind}`} className="card card-link p-5">
              <p className="mb-1 text-sm font-bold text-ink">{KIND_LABEL[kind]}</p>
              <p className="text-xs leading-relaxed text-muted">{blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // Listed so the journey reads end to end, locked because each one needs an
  // id to save against. Off-walk pills sit where the editor puts them.
  const [first, ...rest] = stepsFor(kind)
  const steps: EditStep[] = [
    {
      id: first,
      label: LABELS[first],
      status: 'attention',
      content: (
        <div className="panel pt-5">
          <div className="px-5 pb-5">
            <NewTutorialForm kind={kind} />
          </div>
        </div>
      ),
    },
    ...rest.map((id) => ({
      id,
      label: LABELS[id],
      status: 'neutral' as const,
      disabled: true,
      offWalk: id === 'team',
      content: null,
    })),
  ]

  return (
    <div>
      <BackLink href="/upload" label="New tutorial" />
      <h1 className="mb-2 title-article">New {KIND_LABEL[kind].toLowerCase()}</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Name it now — the guide, parts, tools and everything else come next.
      </p>
      {/* useSearchParams() inside Stepper requires a Suspense boundary, or
          `next build` fails to prerender this page. */}
      <Suspense>
        <Stepper steps={steps} label="Tutorial sections" />
      </Suspense>
    </div>
  )
}
