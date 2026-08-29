/**
 * Step manifest and status rules for the edit-tutorial stepper. Status
 * mirrors getMissingFields() in lib/validation.ts exactly — that function
 * stays the single source of truth for what's required to submit; this
 * module only groups its output per step and adds the purely-optional
 * sections (STL, Team) that getMissingFields() never covers because they're
 * not required.
 */
import type { ReactNode } from 'react'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'
import { getMissingFields } from '@/lib/validation'

export type EditStepId =
  | 'details'
  | 'files'
  | 'parts'
  | 'tools'
  | 'stl'
  /* Collaborators and backing, which were two steps until 2026-08-29. Both
     answer the same question — who else is attached to this tutorial — and
     neither is ever a reason it cannot be submitted, so they read better as
     one stop than as two, and as a stop off the walk rather than on it. */
  | 'team'
  | 'review'
export type EditStepStatus = 'done' | 'attention' | 'neutral'

export interface EditStep {
  id: EditStepId
  label: string
  status: EditStepStatus
  content: ReactNode
  /** Shown in the pill row but not reachable — the New-tutorial page uses this
   *  so the whole journey is visible before the tutorial exists to hang files,
   *  parts and tools off. Mirrors ToyStep.disabled. */
  disabled?: boolean
  /** Off the walk. The pill moves to the right end of the rail in its own
   *  colour, and the step drops out of the sequence entirely: nothing before it
   *  offers it as Next, it never becomes the last step, and while it is open
   *  the stepper draws neither the submit bar nor a Next control.
   *
   *  Team sets it. Nothing there is required, so putting it between Tools and
   *  Review made a contributor walk past it to finish, and a submit button
   *  beside an invite field only asks what it would submit. Off to the side, it
   *  is somewhere you go when you want it — the Review step asks whether you
   *  do. */
  trailing?: boolean
}

/** A gap left in the tutorial, and the step that fixes it. */
export interface MissingStep {
  step: EditStepId
  /** What a person would call it, not what the validator calls it. */
  label: string
}

/*
 * The four required steps, the getMissingFields() labels each one owns, and
 * the words to show a contributor instead of those labels.
 *
 * One table rather than the four arrays this held before, because the same
 * mapping now answers two questions: which pill takes a status dot, and which
 * step a gap in the submit bar sends you to. Splitting them was how they would
 * drift.
 *
 * getMissingFields() stays the single source of truth for *what* is missing —
 * these are only its display names, which is why the keys are its strings
 * verbatim.
 */
const REQUIRED: { step: EditStepId; fields: Record<string, string> }[] = [
  { step: 'details', fields: { Title: 'A title', Difficulty: 'A difficulty' } },
  { step: 'files', fields: { 'Tutorial PDF': 'The guide PDF', 'Toy photo': 'A toy photo' } },
  { step: 'parts', fields: { 'At least one part': 'A part' } },
  { step: 'tools', fields: { 'At least one tool': 'A tool' } },
]

function fieldStatus(missing: string[], step: EditStepId): EditStepStatus {
  const owned = REQUIRED.find((r) => r.step === step)
  return owned && missing.some((f) => f in owned.fields) ? 'attention' : 'done'
}

/**
 * Every gap still open, in step order, each paired with the step that closes
 * it. The submit bar renders these as controls, so a contributor reads what is
 * left and reaches the fix in one click rather than hunting the pill row.
 */
export function missingByStep(
  tutorial: TutorialWithDetails
): MissingStep[] {
  const missing = getMissingFields(tutorial)
  return REQUIRED.flatMap(({ step, fields }) =>
    missing.filter((f) => f in fields).map((f) => ({ step, label: fields[f] }))
  )
}

export function computeStepStatuses(
  tutorial: TutorialWithDetails,
  backing: TutorialOrg[]
): Record<EditStepId, EditStepStatus> {
  const missing = getMissingFields(tutorial)
  return {
    details: fieldStatus(missing, 'details'),
    files: fieldStatus(missing, 'files'),
    parts: fieldStatus(missing, 'parts'),
    tools: fieldStatus(missing, 'tools'),
    stl: tutorial.stl_files.length > 0 ? 'done' : 'neutral',
    // Either half counts: a tutorial with a co-author and no backer has a team,
    // and so has one backed by an organisation the contributor works alone on.
    team:
      backing.length > 0 || tutorial.tutorial_contributors.length > 1 ? 'done' : 'neutral',
    // Mirrors the toy Review pill: neutral while the tutorial is still the
    // contributor's to finish, done once it has been handed over for review.
    review: tutorial.status === 'draft' ? 'neutral' : 'done',
  }
}
