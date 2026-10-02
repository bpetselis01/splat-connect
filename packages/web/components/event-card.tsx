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
import type { Route } from 'next'
import Image from 'next/image'
import { Clock, MapPin, VideoCamera, Image as ImageIcon } from '@phosphor-icons/react/dist/ssr'
import { dateBadge, formatTimeRange } from '@splat-connect/types'
import { safePhotoSrc } from '@/lib/photo-src'
import { EventRsvpButton } from '@/components/event-rsvp-button'
import { EVENT_KIND_LABEL, type EventKind, type EventListItem } from '@splat-connect/types'

/** One tint per kind, carried by the date tile, the kind pill and the cover. */
export const KIND_TINT: Record<EventKind, string> = {
  build_day: 'var(--tmint)',
  workshop: 'var(--tamber)',
  open_day: 'var(--tviolet)',
  print_day: 'var(--tcoral)',
}

/** Where an event is, in the fewest words that still place it. */
function eventWhere(event: EventListItem): string {
  // Falls back to the venue line, then to nothing at all rather than a bare
  // map pin. 061 made suburb and state required on a published in-person
  // event, but NOT VALID — rows written under 059 predate both columns and
  // still render here.
  return event.format === 'online'
    ? 'Online'
    : [event.suburb, event.state].filter(Boolean).join(', ') || event.location || ''
}

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
  const where = eventWhere(event)
  const tint = KIND_TINT[event.kind]
  const href = `/get-involved/events/${event.id}` as Route
  const photo = safePhotoSrc(event.photo_urls[0] ?? null)
  const online = event.format === 'online'

  return (
    <article className="card card-link grid items-center gap-4 px-[18px] py-4 shadow-[var(--e1),var(--hi)] sm:grid-cols-[64px_120px_minmax(0,1fr)_auto]">
      {/* The tile and the picture are decorative beside the title link below —
          announcing "Sun 20 Sep" twice is not an improvement, so the date is in
          the card's own meta line for a screen reader and these are hidden. */}
      <Link
        href={href}
        aria-hidden="true"
        tabIndex={-1}
        className="grid w-16 place-items-center rounded-[18px] py-2 text-[var(--tink)]"
        style={{ background: tint }}
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[.08em]">{badge.weekday}</span>
        <span className="font-display text-[26px] font-extrabold leading-none">{badge.day}</span>
        <span className="text-[11px] font-extrabold uppercase">{badge.month}</span>
      </Link>
      <Link
        href={href}
        aria-hidden="true"
        tabIndex={-1}
        className="relative hidden h-[84px] overflow-hidden rounded-[18px] bg-[var(--surface2)] sm:grid sm:place-items-center"
      >
        {photo ? (
          <Image src={photo} alt="" fill className="object-cover" />
        ) : (
          <ImageIcon weight="duotone" className="text-3xl text-muted opacity-70" />
        )}
      </Link>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-[9px] py-0.5 text-[11px] font-extrabold uppercase tracking-[.06em] text-[var(--tink)]"
            style={{ background: tint }}
          >
            {EVENT_KIND_LABEL[event.kind]}
          </span>
          {where && (
            <span className="inline-flex items-center gap-1 text-[13px] font-bold text-muted">
              {online ? <VideoCamera weight="bold" aria-hidden="true" /> : <MapPin weight="bold" aria-hidden="true" />}
              {where}
            </span>
          )}
        </span>
        <h3 className="font-display text-[19px] font-extrabold leading-[1.2] text-ink">
          <Link href={href} className="hover:text-[var(--b700)]">
            {event.title}
          </Link>
        </h3>
        <span className="inline-flex flex-wrap items-center gap-1 text-sm font-semibold text-muted">
          <Clock weight="bold" aria-hidden="true" />
          <span className="sr-only">
            {badge.weekday} {badge.day} {badge.month},{' '}
          </span>
          {formatTimeRange(event.starts_at, event.ends_at, event.format)}
          {where && (
            <>
              <span aria-hidden="true">·</span>
              <MapPin weight="bold" aria-hidden="true" />
              {where}
            </>
          )}
        </span>
        <span className="text-[13px] text-muted">
          Hosted by{' '}
          <Link
            href={`/organizations/${event.org_id}/public`}
            className="font-extrabold text-[var(--b700)] underline"
          >
            {event.org_name}
          </Link>
        </span>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <EventRsvpButton
          eventId={event.id}
          going={event.viewer_going}
          signedIn={signedIn}
          needsForm={hasQuestions ?? false}
        />
        <span className="whitespace-nowrap text-[13px] font-bold text-muted">
          {event.going_count} going
          {event.seats_left !== null && ` · ${event.seats_left} seats left`}
        </span>
      </div>
    </article>
  )
}

/** A past event: the compact, faded row under the fold. */
export function PastEventRow({ event }: { event: EventListItem }) {
  const badge = dateBadge(event.starts_at)
  return (
    <Link
      href={`/get-involved/events/${event.id}`}
      className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-line bg-[var(--surface)] px-3.5 py-2.5 text-ink opacity-85 hover:bg-[var(--surface2)] hover:opacity-100"
    >
      <span className="grid place-items-center rounded-[14px] bg-[var(--surface2)] py-1 text-muted">
        <span className="font-display text-lg font-extrabold leading-none">{badge.day}</span>
        <span className="text-[10px] font-extrabold uppercase">{badge.month}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-extrabold">{event.title}</span>
        <span className="block text-[13px] text-muted">
          {event.org_name} · {event.going_count} went
        </span>
      </span>
    </Link>
  )
}
