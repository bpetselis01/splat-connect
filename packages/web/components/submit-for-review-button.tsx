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
