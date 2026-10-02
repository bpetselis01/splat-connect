'use client'
/**
 * "Follow the write-up" on a graduated challenge (challenge-writeup-stage). A
 * save under another name: 109 tells every saver when the guide is published.
 * Says so inline — the public challenge page has no toast host.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NotePencil } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function FollowWriteup({ id, signedIn, next }: { id: string; signedIn: boolean; next: string }) {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function follow() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(next)}`)
    setError(null)
    try {
      await browserApiClient.post('/api/saves', { entity_type: 'challenge', entity_id: id })
      setDone(true)
    } catch {
      setError('That did not go through. Try once more.')
    }
  }

  return (
    <span className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={follow} className="btn btn-primary min-h-12 px-[22px] text-[15px]">
        <NotePencil weight="bold" aria-hidden="true" /> Follow the write-up
      </button>
      {done && (
        <span role="status" className="text-[13px] font-bold text-muted">
          You will be told when the guide is published
        </span>
      )}
      {error && (
        <span role="alert" className="text-[13px] text-[var(--bad)]">
          {error}
        </span>
      )}
    </span>
  )
}
