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
import { Clock, MapPin, VideoCamera } from '@phosphor-icons/react/dist/ssr'
import { KIND_TINT } from '@/components/event-card'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { EventRegisterForm } from '@/components/event-register-form'
import { dateBadge, formatTimeRange } from '@splat-connect/types'
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
    <div className="max-w-[760px]">
      <h1 className="font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
        Register for this event
      </h1>
      <p className="mt-2.5 max-w-[60ch] text-[17px] text-muted [text-wrap:pretty]">
        {orgName} asks a few things so the day is set up for the people in the room.
      </p>

      {/* The event restated, so nobody fills in a form for the wrong Sunday. */}
      <div className="mt-[22px] flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-[var(--surface)] px-[18px] py-4 shadow-[var(--e1)]">
        <span
          aria-hidden="true"
          className="grid w-[54px] shrink-0 place-items-center rounded-[18px] py-2 text-[var(--tink)]"
          style={{ background: KIND_TINT[event.kind] }}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-[.08em]">{badge.weekday}</span>
          <span className="font-display text-2xl font-extrabold leading-none">{badge.day}</span>
          <span className="text-[10px] font-extrabold uppercase">{badge.month}</span>
        </span>
        <span className="min-w-[220px] flex-1">
          <span className="block font-display text-[19px] font-extrabold leading-[1.2]">{event.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1 text-sm font-semibold text-muted">
            <Clock weight="bold" aria-hidden="true" />
            {formatTimeRange(event.starts_at, event.ends_at, event.format)}
            <span aria-hidden="true">·</span>
            {event.format === 'online' ? (
              <VideoCamera weight="bold" aria-hidden="true" />
            ) : (
              <MapPin weight="bold" aria-hidden="true" />
            )}
            {where}
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            Hosted by {orgName} · {event.going_count} going
            {event.seats_left !== null && ` · ${event.seats_left} seats left`}
          </span>
        </span>
      </div>

      <EventRegisterForm
        eventId={event.id}
        orgName={orgName}
        questions={event.questions}
        defaultName={caps.profile.name ?? ''}
        defaultEmail={caps.profile.email ?? ''}
        costCents={event.cost_cents}
        costNote={event.cost_note}
      />
    </div>
  )
}
