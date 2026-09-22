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
 * Cancelling asks first, inline: the first press arms it. It is the one action here that other people's Sunday
 * depends on.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarX, LockOpen, LockSimple, XCircle } from '@phosphor-icons/react/dist/ssr'
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
  const [confirming, setConfirming] = useState(false)
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
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-inset bg-apricot-soft px-5 py-4 text-ink">
        <span className="inline-flex items-center gap-2 font-extrabold">
          <XCircle weight="fill" aria-hidden="true" />
          Cancelled. The public page says so.
        </span>
        <button
          type="button"
          onClick={() => patch({ cancelled: false })}
          disabled={busy}
          className="btn btn-quiet min-h-11 px-3.5 text-sm"
        >
          Restore
        </button>
        {error && (
          <p role="alert" className="alert alert-danger w-full">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-inset bg-sunken px-[18px] py-3.5">
        <span className="mr-auto text-xs font-extrabold uppercase tracking-[.1em] text-muted">
          Too much to manage?
        </span>
        <button
          type="button"
          onClick={() => patch({ registrations_closed: !registrationsClosed })}
          disabled={busy}
          aria-pressed={registrationsClosed}
          className="btn btn-quiet min-h-11 px-3.5 text-sm"
        >
          {registrationsClosed ? (
            <LockOpen weight="bold" aria-hidden="true" />
          ) : (
            <LockSimple weight="bold" aria-hidden="true" />
          )}
          {registrationsClosed ? 'Reopen registrations' : 'Close registrations'}
        </button>
        <button
          type="button"
          // Other people's Sunday depends on this one, so the first press only
          // arms it; the label then says what the second press does.
          onClick={() => (confirming ? patch({ cancelled: true }) : setConfirming(true))}
          disabled={busy}
          className="btn btn-quiet min-h-11 px-3.5 text-sm text-danger"
        >
          <CalendarX weight="bold" aria-hidden="true" />
          {confirming ? 'Yes, cancel this event' : 'Cancel this event'}
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
