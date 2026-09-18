/**
 * What a tutorial needs before it can be submitted for review, as gaps: the
 * step that closes each one, and the words to show a contributor.
 *
 * It returned bare English strings until 2026-08-30, and lib/edit-steps.ts
 * kept a table translating each of them back into a step and a second label —
 * a map keyed on prose, and two places to edit to add one rule. The gap is the
 * answer both callers wanted, so it is what this returns: the submit bar
 * renders them, and each pill's status dot is which steps appear here.
 *
 * canAdvanceFromStep and canSubmit lived here too, gating the Next button of
 * the six-step upload wizard. That wizard is gone — the edit page's steps
 * replaced it — and with it the only notion of a step you had to earn.
 */
import type { TutorialWithDetails } from '@splat-connect/types'
import type { Gap } from '@/lib/steps'
import type { EditStepId } from '@/lib/edit-steps'

export function getMissingFields(tutorial: TutorialWithDetails): Gap<EditStepId>[] {
  const missing: Gap<EditStepId>[] = []
  if (!tutorial.title.trim()) missing.push({ step: 'details', label: 'A title' })
  if (!(['easy', 'medium', 'hard'] as string[]).includes(tutorial.difficulty))
    missing.push({ step: 'details', label: 'A difficulty' })
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push({ step: 'files', label: 'The guide PDF' })
  if (tutorial.photo_urls.length === 0) missing.push({ step: 'files', label: 'A photo' })
  if (tutorial.parts.length === 0) missing.push({ step: 'parts', label: 'A part' })
  if (tutorial.tools.length === 0) missing.push({ step: 'tools', label: 'A tool' })
  // The one rule that reads the kind: a printed part is what an assistive-tech
  // tutorial IS, so it cannot be submitted without one. A toy adaptation has no
  // STL step at all, so the gap must never appear for it.
  if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
    missing.push({ step: 'stl', label: 'A 3D-print file' })
  if (!tutorial.safety_declared_at) missing.push({ step: 'details', label: 'The safety declaration' })
  return missing
}
