/**
 * Add a tutorial — the board's single card: what kind of guide, a title, a
 * cover photo and a difficulty, then the editor takes over.
 *
 * Was a six-step wizard, then a kind-picker page ahead of a one-step form with
 * the editor's locked pills beside it. Every step after this one lives on the
 * edit page, so this page only brings the row into existence. `?kind=` still
 * preselects the kind, so older links land on the right card.
 *
 * No contributor-terms gate here: middleware.ts redirects /upload to
 * /onboarding/contributor-terms before this renders, and POST /api/tutorials
 * refuses without them — a third check in the page could only ever disagree.
 *
 * Related files:
 * - components/new-tutorial-form.tsx: creates the draft and redirects
 * - app/tutorials/[id]/edit/page.tsx: every step after this one
 */
import { NewTutorialForm } from '@/components/new-tutorial-form'
import type { TutorialKind } from '@splat-connect/types'

export const metadata = { title: 'Add a tutorial — SPLAT Connect' }

function isKind(v: string | undefined): v is TutorialKind {
  return v === 'toy_adaptation' || v === 'assistive_tech'
}

export default async function NewTutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind } = await searchParams

  return (
    <div className="max-w-[720px]">
      <h1 className="title-hub">Add a tutorial</h1>
      <p className="mt-2.5 max-w-[60ch] text-[17px] text-muted">
        Two things to begin: what the toy is, and one photo — everything else can wait for the
        editor.
      </p>
      <div className="mt-7">
        <NewTutorialForm kind={isKind(kind) ? kind : undefined} />
      </div>
    </div>
  )
}
