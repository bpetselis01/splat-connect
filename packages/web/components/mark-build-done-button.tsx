'use client'
/**
 * Mark this build done (091): one tap logs it to My SPLAT. Idempotent on the
 * server, so a second tab's tap is harmless; the button settles on "Build logged".
 * The result is said inline: the public tutorial page has no toast host.
 */
import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function MarkBuildDoneButton({ tutorialId }: { tutorialId: string }) {
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <>
      <button
        type="button"
        disabled={done || pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await browserApiClient.post(`/api/tutorials/${tutorialId}/build`, {})
            setDone(true)
          } catch {
            setFailed(true)
          } finally {
            setPending(false)
          }
        }}
        className="btn btn-quiet btn-sm gap-2"
      >
        <CheckCircle weight="bold" aria-hidden="true" />
        {done ? 'Build logged' : 'Mark this build done'}
      </button>
      {done && <p role="status" className="m-0 text-sm font-bold text-ink">Build logged — nice work</p>}
      {failed && <p role="alert" className="m-0 text-sm font-bold text-danger">Could not log that. Try again.</p>}
    </>
  )
}
