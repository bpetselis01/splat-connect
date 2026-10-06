'use client'

/**
 * Pin a community note as a revision, or unpin it (093). Shown only to the
 * guide's authors and admins; the api checks the same thing again
 * (POST /api/tutorials/:id/notes/:noteId/pin | unpin), so this gate is
 * convenience, not security.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function NotePinButton({ tutorialId, noteId, pinned }: { tutorialId: string; noteId: string; pinned: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    setPending(true)
    setFailed(false)
    try {
      await browserApiClient.post(`/api/tutorials/${tutorialId}/notes/${noteId}/${pinned ? 'unpin' : 'pin'}`, {})
      router.refresh()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={pending} className="btn btn-quiet btn-sm">
        {pinned ? 'Unpin' : 'Pin as revision'}
      </button>
      {failed && (
        <span role="alert" className="text-sm font-semibold text-[var(--bad)]">
          That did not work. Try again.
        </span>
      )}
    </span>
  )
}
