import type { UploadDraft } from './types'

export function canAdvanceFromStep(step: number, draft: UploadDraft): boolean {
  switch (step) {
    case 1:
      return (
        draft.title.trim().length > 0 &&
        ['easy', 'medium', 'hard'].includes(draft.difficulty)
      )
    case 2:
      return draft.tutorial_pdf_url !== null && draft.toy_photo_url !== null
    case 3:
      return (
        draft.parts.length >= 1 &&
        draft.parts.every(
          (p) => p.name.trim().length > 0 && p.quantity >= 1
        )
      )
    case 4:
      return (
        draft.tools.length >= 1 &&
        draft.tools.every((t) => t.name.trim().length > 0)
      )
    case 5:
      return true // STL files are optional
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
