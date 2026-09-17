'use client'
/**
 * The two ways a host takes an event back, and they are deliberately not one
 * control.
 *
 * Closing registrations leaves the event on the public list with its date and
 * address intact, so the eleven people already coming still know where to turn
 * up. Cancelling takes it off. Collapsing them into a single "unpublish" would
 * lose exactly the distinction a family needs most, which is why 061 stores
 * them as two timestamps rather than one status.
 *
 * Cancelling asks first. It is the one action here that other people's Sunday
 * depends on.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, LockOpen, XCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function EventWithdrawActions({
  orgId,
  eventId,
  registrationsClosed,
  cancelled,
}: {
  orgId: string
  eventId: string
  registrationsClosed: boolean
  cancelled: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  async function patch(body: Record<string, unknown>) {
    setError(null)
    setBusy(true)
    try {
      await browserApiClient.patch(`/api/organizations/${orgId}/events/${eventId}`, body)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(false)
    }
  }

  if (cancelled) {
    return (
      <div className="alert alert-danger mt-4">
        <p className="font-bold">This event is cancelled.</p>
        <button
          type="button"
          onClick={() => patch({ cancelled: false })}
          disabled={busy}
          className="btn btn-quiet btn-sm mt-2"
        >
          Reinstate it
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-muted">Too much to manage?</span>
        <button
          type="button"
          onClick={() => patch({ registrations_closed: !registrationsClosed })}
          disabled={busy}
          className="btn btn-quiet btn-sm"
        >
          {registrationsClosed ? (
            <>
              <LockOpen className="h-4 w-4" aria-hidden="true" />
              Reopen registrations
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Close registrations
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            // Other people's Sunday depends on this one, so it asks.
            if (confirm('Cancel this event? Everyone registered will see that it is off.')) {
              patch({ cancelled: true })
            }
          }}
          disabled={busy}
          className="btn btn-danger btn-sm"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Cancel this event
        </button>
      </div>
      {registrationsClosed && (
        <p className="mt-2 text-sm text-muted">
          Registrations are closed. The event is still on the public list, with its date and
          address, for the people already coming.
        </p>
      )}
      {error && (
        <p role="alert" className="alert alert-danger mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
