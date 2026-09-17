/**
 * Register for an event.
 *
 * Its own page rather than a dialog on the detail screen, because the questions
 * an organiser adds can run to a paragraph each and a modal is the wrong place
 * to type one. It is also a URL, which matters: a family who gets halfway
 * through and has to go and find the toy's model number can come back to it.
 *
 * Signed out lands on /login and returns here, not to the event — a guest who
 * signs in mid-registration is mid-registration.
 *
 * Related files:
 * - components/event-register-form.tsx: the form itself
 * - packages/api/src/routes/events.ts: where the answers go
 */
import { notFound, redirect } from 'next/navigation'
import { CalendarDots, Clock, MapPin } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { EventRegisterForm } from '@/components/event-register-form'
import { dateBadge, formatTimeRange } from '@/lib/event-dates'
import type { EventListItem, OrgEventQuestion } from '@splat-connect/types'

export const metadata = { title: 'Register for an event — SPLAT Connect' }

type EventDetail = EventListItem & {
  org: { id: string; name: string } | null
  questions: OrgEventQuestion[]
}

export default async function EventRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) {
    redirect(`/login?next=${encodeURIComponent(`/get-involved/events/${id}/register`)}`)
  }

  const event = await apiClient.get<EventDetail>(`/api/public/events/${id}`).catch(() => null)
  if (!event) notFound()

  // Registering for a cancelled or closed event is not a form problem, so it is
  // not shown as one — the detail page says what happened.
  if (event.cancelled_at || event.registrations_closed_at) {
    redirect(`/get-involved/events/${id}`)
  }

  const badge = dateBadge(event.starts_at)
  const orgName = event.org?.name ?? 'the host'
  const where =
    event.format === 'online' ? 'Online' : [event.suburb, event.state].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="title-article">Register for this event</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {orgName} asks a few things so the day is set up for the people in the room.
      </p>

      {/* The event restated, so nobody fills in a form for the wrong Sunday. */}
      <div className="card mt-5 flex items-center gap-4 p-4">
        <span
          aria-hidden="true"
          className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-card bg-brand-tint text-brand-deep"
        >
          <span className="eyebrow leading-none">{badge.weekday}</span>
          <span className="font-display text-xl font-extrabold leading-tight">{badge.day}</span>
          <span className="eyebrow leading-none">{badge.month}</span>
        </span>
        <div className="min-w-0">
          <p className="font-bold text-ink">{event.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatTimeRange(event.starts_at, event.ends_at, event.format)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {where}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            <CalendarDots className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            Hosted by {orgName} · {event.going_count} going
            {event.seats_left !== null && ` · ${event.seats_left} seats left`}
          </p>
        </div>
      </div>

      <EventRegisterForm
        eventId={event.id}
        orgName={orgName}
        questions={event.questions}
        defaultName={caps.profile.name ?? ''}
        defaultEmail={caps.profile.email ?? ''}
      />
    </div>
  )
}
