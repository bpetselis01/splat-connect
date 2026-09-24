'use client'

/**
 * Say thanks for a guide: one tap adds one to its public count, once per
 * person (066, POST /api/tutorials/:id/thanks). No note, no undo.
 *
 * Four states, all decided by the server page: signed out (goes to /signup
 * with the reason, like SaveButton), your own guide (the count, read-only —
 * a contributor cannot thank themselves), already thanked, and ready.
 */
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { HandHeart } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { isApiError } from '@splat-connect/types'
import { useToast } from '@/components/toast'

export function ThanksButton({
  tutorialId,
  count: initialCount,
  thanked: initiallyThanked,
  own,
  signedIn,
}: {
  tutorialId: string
  count: number
  thanked: boolean
  own: boolean
  signedIn: boolean
}) {
  const [count, setCount] = useState(initialCount)
  const [thanked, setThanked] = useState(initiallyThanked)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const showToast = useToast()

  const heart = <HandHeart weight="fill" className="text-apricot" aria-hidden="true" />

  if (own) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted">
        {heart}
        {count} {count === 1 ? 'thank' : 'thanks'}
      </span>
    )
  }

  async function thank() {
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(pathname)}&reason=thanks`)
      return
    }
    setPending(true)
    try {
      const res = await browserApiClient.post<{ thanks_count: number }>(
        `/api/tutorials/${tutorialId}/thanks`,
        {}
      )
      setCount(res.thanks_count)
      setThanked(true)
      showToast('Thanks sent — they will see it in their notifications')
    } catch (err) {
      // 409: thanked already, from another tab. The button should say so
      // rather than invite a retry that can never succeed.
      if (isApiError(err) && err.status === 409) setThanked(true)
      else showToast('Could not send that. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={thank}
      disabled={thanked || pending}
      aria-label={thanked ? `Thanked. ${count} thanks` : `Say thanks. ${count} thanks so far`}
      className="btn btn-quiet btn-sm gap-2"
    >
      {heart}
      {thanked ? 'Thanked' : 'Say thanks'}
      <span className="tabular-nums text-muted">{count}</span>
    </button>
  )
}
