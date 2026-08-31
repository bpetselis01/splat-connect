/**
 * Step manifest and status rules for the edit-tutorial stepper. Status
 * mirrors getMissingFields() in lib/validation.ts exactly — that function
 * stays the single source of truth for what's required to submit; this
 * module only groups its output per step and adds the purely-optional
 * sections (Team, Recommended) that getMissingFields() never covers because
 * they're not required.
 */
import type { TutorialWithDetails, TutorialOrg, TutorialKind } from '@splat-connect/types'
import type { Gap, Step, StepStatus } from '@/lib/steps'
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
  /* Up to three other tutorials the creator points readers at. On the walk,
     last before Review, because it is the last piece of what a parent sees —
     a peer of Parts and STL, not of Team. It sat beside Team as a second
     trailing pill for a day (2026-08-29) and two orange stops read as a
     button row; the accent was written for one. Optional all the same: the
     dot is neutral until something is picked, as Review's is. */
  | 'recommended'
  | 'review'

export type EditStep = Step<EditStepId>

/**
 * The pills a tutorial of this kind shows, in rail order. The two kinds differ
 * by exactly one step: an assistive-tech build has STL files to print and a
 * toy adaptation never does, which is the whole reason kind exists as a column
 * rather than as a second pipeline. Both the editor and /upload draw from this,
 * so the locked preview and the real thing cannot disagree.
 */
export function stepsFor(kind: TutorialKind): EditStepId[] {
  return kind === 'assistive_tech'
    ? ['details', 'files', 'parts', 'tools', 'stl', 'recommended', 'review', 'team']
    : ['details', 'files', 'parts', 'tools', 'recommended', 'review', 'team']
}

/**
 * A pill takes the hazard dot when getMissingFields() has something to say
 * about its step — one question against one list, rather than the table of
 * validator strings this used to keep. Steps it never names (Team, Recommended)
 * are not asked; they answer for themselves below.
 */
function fieldStatus(missing: Gap<EditStepId>[], step: EditStepId): StepStatus {
  return missing.some((m) => m.step === step) ? 'attention' : 'done'
}

export function computeStepStatuses(
  tutorial: TutorialWithDetails,
  backing: TutorialOrg[]
): Record<EditStepId, StepStatus> {
  const missing = getMissingFields(tutorial)
  return {
    details: fieldStatus(missing, 'details'),
    files: fieldStatus(missing, 'files'),
    parts: fieldStatus(missing, 'parts'),
    tools: fieldStatus(missing, 'tools'),
    // Only ever reported for an assistive-tech tutorial — getMissingFields()
    // reads the kind — so a toy adaptation never earns a dot here and never
    // shows the pill (see stepsFor).
    stl: fieldStatus(missing, 'stl'),
    recommended: tutorial.tutorial_recommendations.length > 0 ? 'done' : 'neutral',
    // Either half counts: a tutorial with a co-author and no backer has a team,
    // and so has one backed by an organisation the contributor works alone on.
    team:
      backing.length > 0 || tutorial.tutorial_contributors.length > 1 ? 'done' : 'neutral',
    // Mirrors the toy Review pill: neutral while the tutorial is still the
    // contributor's to finish, done once it has been handed over for review.
    review: tutorial.status === 'draft' ? 'neutral' : 'done',
  }
}
