'use client'
/**
 * Mark this build done (091): one tap logs it to My SPLAT. Idempotent on the
 * server, so a second tab's tap is harmless; the button settles on "Build logged".
 */
import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { useToast } from '@/components/toast'

export function MarkBuildDoneButton({ tutorialId }: { tutorialId: string }) {
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const showToast = useToast()
  return (
    <button
      type="button"
      disabled={done || pending}
      onClick={async () => {
        setPending(true)
        try {
          await browserApiClient.post(`/api/tutorials/${tutorialId}/build`, {})
          setDone(true)
          showToast('Build logged — nice work')
        } catch {
          showToast('Could not log that. Try again.')
        } finally {
          setPending(false)
        }
      }}
      className="btn btn-quiet btn-sm gap-2"
    >
      <CheckCircle weight="bold" aria-hidden="true" />
      {done ? 'Build logged' : 'Mark this build done'}
    </button>
  )
}
