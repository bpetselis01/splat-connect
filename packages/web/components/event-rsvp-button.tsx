'use client'
/**
 * "I'm going" — the one-tap RSVP from a list card or the detail page.
 *
 * Three destinations, decided here rather than by the caller so every surface
 * behaves the same:
 *
 * - No session → /login, with `next` set so the tap resumes where it started.
 *   A guest who signs in mid-RSVP should land back on the event, not the hub.
 * - The event asks its own questions → /register, because a tap that silently
 *   skipped three required answers would put a family on a list the host
 *   cannot use. This is why the button is not simply a POST everywhere.
 * - Otherwise → the POST, and the label flips.
 *
 * Optimistic, and it says so on failure rather than quietly reverting: a family
 * who thinks they have a seat and does not is the one outcome worth a sentence.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CalendarCheck } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function EventRsvpButton({
  eventId,
  going,
  signedIn,
  needsForm,
  name,
  email,
}: {
  eventId: string
  going: boolean
  signedIn: boolean
  needsForm: boolean
  /** The account's own name and email, used for the no-questions fast path. */
  name?: string
  email?: string
}) {
  const router = useRouter()
  const [isGoing, setIsGoing] = useState(going)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const next = encodeURIComponent(`/get-involved/events/${eventId}`)

  async function toggle() {
    setError(null)
    const was = isGoing
    setIsGoing(!was)
    try {
      if (was) {
        await browserApiClient.delete(`/api/events/${eventId}/registrations`)
      } else {
        await browserApiClient.post(`/api/events/${eventId}/registrations`, {
          name,
          email,
          answers: {},
        })
      }
      startTransition(() => router.refresh())
    } catch (e) {
      setIsGoing(was)
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    }
  }

  if (!signedIn) {
    return (
      <a href={`/login?next=${next}`} className="btn btn-primary btn-sm">
        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        I&apos;m going
      </a>
    )
  }

  if (needsForm && !isGoing) {
    return (
      <a href={`/get-involved/events/${eventId}/register`} className="btn btn-primary btn-sm">
        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        I&apos;m going
      </a>
    )
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        // aria-pressed, not a label that only changes colour: "I'm going" and
        // "You're going" are one word apart read aloud.
        aria-pressed={isGoing}
        className={`btn btn-sm ${isGoing ? 'btn-soft' : 'btn-primary'}`}
      >
        {isGoing ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        )}
        {isGoing ? "You're going" : "I'm going"}
      </button>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
