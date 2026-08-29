/**
 * What a tutorial needs before it can be submitted for review, as user-facing
 * labels. Consumed by the Review step's submit gate and, through
 * lib/edit-steps.ts, by each pill's status dot.
 *
 * canAdvanceFromStep and canSubmit lived here too, gating the Next button of
 * the six-step upload wizard. That wizard is gone — the edit page's steps
 * replaced it — and with it the only notion of a step you had to earn.
 */
import type { TutorialWithDetails } from '@splat-connect/types'

export function getMissingFields(tutorial: TutorialWithDetails): string[] {
  const missing: string[] = []
  if (!tutorial.title.trim()) missing.push('Title')
  if (!(['easy', 'medium', 'hard'] as string[]).includes(tutorial.difficulty))
    missing.push('Difficulty')
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push('Tutorial PDF')
  if (!tutorial.toy_photo_url?.trim()) missing.push('Photo')
  if (tutorial.parts.length === 0) missing.push('At least one part')
  if (tutorial.tools.length === 0) missing.push('At least one tool')
  // The one rule that reads the kind: a printed part is what an assistive-tech
  // tutorial IS, so it cannot be submitted without one. A toy adaptation has no
  // STL step at all, so the label must never appear for it.
  if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
    missing.push('At least one STL file')
  return missing
}
