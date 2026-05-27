/**
 * Submit For Review Button
 * 
 * Button that submits a draft tutorial for admin review.
 * Validates all required fields before allowing submission.
 * 
 * Props:
 * - tutorial: TutorialWithDetails object (current state)
 * - action: Server action to execute on click (updates tutorial status)
 * 
 * Behavior:
 * 1. User clicks button
 * 2. getMissingFields() checks for incomplete fields
 * 3. If missing fields: alert shows what's needed
 * 4. If complete: server action executes (changes status: draft → pending)
 * 5. Tutorial is now waiting for admin review
 * 
 * Missing fields check:
 * - Title must be filled
 * - Difficulty must be selected
 * - PDF must be uploaded
 * - Toy photo must be uploaded
 * - At least 1 part required
 * - At least 1 tool required
 * - STL files are optional
 * 
 * States:
 * - pending: True while server action executing (button disabled, shows loading)
 * - Normal: Can be clicked
 * 
 * Related files:
 * - lib/validation.ts: getMissingFields() function
 * - app/upload: Uses this button on final step
 * - routes/tutorials.ts: API endpoint (status: draft → pending)
 * - types/index.ts: TutorialWithDetails type
 */
'use client'
import { useTransition } from 'react'
import type { TutorialWithDetails } from '@splat-connect/types'
import { getMissingFields } from '@/lib/validation'

export function SubmitForReviewButton({
  tutorial,
  action,
}: {
  tutorial: TutorialWithDetails
  action: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const missing = getMissingFields(tutorial)
    if (missing.length > 0) {
      alert(`Cannot submit for review. Please fill in the following:\n\n• ${missing.join('\n• ')}`)
      return
    }
    startTransition(async () => {
      await action()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
    >
      {pending ? 'Submitting…' : 'Submit for review'}
    </button>
  )
}
