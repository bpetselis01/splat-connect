/**
 * Upload Form Validation Utilities
 * 
 * These functions validate the multi-step tutorial upload form in /app/upload.
 * The upload wizard is 6 steps, each with different requirements.
 * 
 * Main functions:
 * 
 * canAdvanceFromStep(step, draft)
 * - Checks if user has completed all requirements for current step
 * - Returns true if they can proceed to next step
 * - Used to enable/disable 'Next' button
 * 
 * Step requirements:
 * 1. Basic Info: title + difficulty selected
 * 2. Files: PDF + photo uploaded
 * 3. Parts: at least 1 part with name & quantity
 * 4. Tools: at least 1 tool with name
 * 5. STL Files: (optional, always passes)
 * 6. Review: all previous steps must be complete
 * 
 * canSubmit(draft)
 * - Checks if form is FULLY complete and ready to submit
 * - Used to enable/disable 'Submit for Review' button
 * 
 * getMissingFields(tutorial)
 * - Returns array of field names that are missing/empty
 * - Used to show error messages to user
 * - Helps user understand what's required before submission
 * 
 * Data flow:
 * 1. User fills upload form (UploadDraft)
 * 2. Component calls canAdvanceFromStep() before allowing 'Next'
 * 3. Component calls canSubmit() before showing 'Submit' button
 * 4. On submit, API creates Tutorial + Parts + Tools + STLFiles
 * 5. Tutorial is created with status='draft'
 * 6. User can continue editing until they submit for review (status→'pending')
 * 
 * Related files:
 * - app/upload/page.tsx: Multi-step form using these validators
 * - types/index.ts: UploadDraft and TutorialWithDetails types
 */
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
