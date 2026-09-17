/**
 * One event on /get-involved/events.
 *
 * The date badge leads, because a list of events is scanned by date before
 * anything else — "can I make that Sunday" comes before "what is it". Then the
 * four things the artboard says a family decides on: what kind, what it is,
 * when and where, and who is running it.
 *
 * The RSVP is one tap from the list (the Luma/Meetup pattern) and only when the
 * event asks nothing else. An event with questions on its form sends you to
 * /register instead, because a button that silently skipped three required
 * questions would put a family on a list the host cannot use.
 *
 * Related files:
 * - lib/event-dates.ts: every date shape on this card
 * - components/event-rsvp-button.tsx: the tap itself, which needs a session
 */
import Link from 'next/link'
import { CalendarDots, MapPin, Clock } from '@phosphor-icons/react/dist/ssr'
import { dateBadge, formatTimeRange } from '@/lib/event-dates'
import { EventRsvpButton } from '@/components/event-rsvp-button'
import { EVENT_KIND_LABEL, type EventListItem } from '@splat-connect/types'

export function EventCard({
  event,
  signedIn,
  hasQuestions,
}: {
  event: EventListItem
  signedIn: boolean
  /** When true the tap goes to the form rather than registering outright. */
  hasQuestions?: boolean
}) {
  const badge = dateBadge(event.starts_at)
  // Falls back to the venue line, then to nothing at all rather than a bare
  // map pin. 061 made suburb and state required on a published in-person
  // event, but NOT VALID — rows written under 059 predate both columns and
  // still render here.
  const where =
    event.format === 'online'
      ? 'Online'
      : [event.suburb, event.state].filter(Boolean).join(', ') || event.location || ''

  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      {/* The badge is decorative beside the title link below — announcing
          "Sun 20 Sep" twice is not an improvement, so the date is in the
          card's own meta line for a screen reader and this is aria-hidden. */}
      <Link
        href={`/get-involved/events/${event.id}`}
        aria-hidden="true"
        tabIndex={-1}
        className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center rounded-card bg-brand-tint text-brand-deep"
      >
        <span className="eyebrow leading-none">{badge.weekday}</span>
        <span className="font-display text-2xl font-extrabold leading-tight">{badge.day}</span>
        <span className="eyebrow leading-none">{badge.month}</span>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-brand-tint text-brand-deep">{EVENT_KIND_LABEL[event.kind]}</span>
          {where && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {where}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 font-display text-lg font-extrabold text-ink">
          <Link href={`/get-involved/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDots className="h-3.5 w-3.5" aria-hidden="true" />
            {badge.weekday} {badge.day} {badge.month}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatTimeRange(event.starts_at, event.ends_at, event.format)}
          </span>
        </p>

        <p className="mt-1 text-sm text-muted">
          Hosted by{' '}
          <Link
            href={`/organizations/${event.org_id}/public`}
            className="font-semibold text-brand-dark hover:underline"
          >
            {event.org_name}
          </Link>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
        <EventRsvpButton
          eventId={event.id}
          going={event.viewer_going}
          signedIn={signedIn}
          needsForm={hasQuestions ?? false}
        />
        <p className="text-xs text-muted sm:text-right">
          {event.going_count} going
          {event.seats_left !== null && ` · ${event.seats_left} seats left`}
        </p>
      </div>
    </article>
  )
}
