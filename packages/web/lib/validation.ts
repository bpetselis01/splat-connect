import type { UploadDraft, TutorialWithDetails } from '@splat-connect/types'

export function canAdvanceFromStep(step: number, draft: UploadDraft): boolean {
  switch (step) {
    case 1:
      return (
        draft.title.trim().length > 0 &&
        ['easy', 'medium', 'hard'].includes(draft.difficulty)
      )
    case 2:
      return (
        !!draft.tutorial_pdf_url?.trim() &&
        !!draft.toy_photo_url?.trim()
      )
    case 3:
      return (
        draft.parts.length >= 1 &&
        draft.parts.every(
          (p) => p.name.trim().length > 0 && Number.isInteger(p.quantity) && p.quantity >= 1
        )
      )
    case 4:
      return (
        draft.tools.length >= 1 &&
        draft.tools.every((t) => t.name.trim().length > 0)
      )
    case 5:
      return true // STL files are optional
    case 6:
      return canSubmit(draft)
    default:
      return false
  }
}

export function canSubmit(draft: UploadDraft): boolean {
  return (
    canAdvanceFromStep(1, draft) &&
    canAdvanceFromStep(2, draft) &&
    canAdvanceFromStep(3, draft) &&
    canAdvanceFromStep(4, draft)
  )
}

export function getMissingFields(tutorial: TutorialWithDetails): string[] {
  const missing: string[] = []
  if (!tutorial.title.trim()) missing.push('Title')
  if (!(['easy', 'medium', 'hard'] as string[]).includes(tutorial.difficulty))
    missing.push('Difficulty')
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push('Tutorial PDF')
  if (!tutorial.toy_photo_url?.trim()) missing.push('Toy photo')
  if (tutorial.parts.length === 0) missing.push('At least one part')
  if (tutorial.tools.length === 0) missing.push('At least one tool')
  return missing
}
