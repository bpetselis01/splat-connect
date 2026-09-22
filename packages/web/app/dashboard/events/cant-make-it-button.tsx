'use client'
/**
 * "Can't make it" — the same DELETE the event page's RSVP toggle sends, from
 * the row where a family is most likely to realise it.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function CantMakeItButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  async function withdraw() {
    setError(null)
    setBusy(true)
    try {
      await browserApiClient.delete(`/api/events/${eventId}/registrations`)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={withdraw}
        disabled={busy || pending}
        className="btn btn-quiet"
      >
        Can&rsquo;t make it
      </button>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
