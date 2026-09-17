/**
 * One event.
 *
 * Leads with the four things the artboard says a family decides on — what,
 * when, where, who it is for — and puts everything else below them. The order
 * is the decision order, not the authoring order: a parent works out whether
 * they can get there before they care what tools are on the bench.
 *
 * Two things are never on this page, whoever is reading it:
 *
 * - An online event's joining link. The API strips it (`online_url: null`), and
 *   a registrant is given it after they confirm. A link on a public page is a
 *   link in a search index.
 * - Anything a registrant answered. "Who is going" is initials and a count, so
 *   the page can say the room will be busy without telling a reader which
 *   families attend which therapy service.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /public/events/:id
 * - app/get-involved/events/[id]/register/page.tsx: the form this leads to
 * - app/events/[id]/calendar.ics/route.ts: Add to calendar
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDots,
  MapPin,
  Users,
  Wrench,
  Package,
  Wheelchair,
  Download,
} from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { EventRsvpButton } from '@/components/event-rsvp-button'
import { longDate, formatTimeRange, dateBadge, isPast } from '@/lib/event-dates'
import { EVENT_KIND_LABEL, type EventListItem, type OrgEventQuestion } from '@splat-connect/types'

type EventDetail = EventListItem & {
  org: { id: string; name: string; description: string | null; suburb: string | null; state: string | null } | null
  questions: OrgEventQuestion[]
  attendee_initials: string[]
}

async function load(id: string, viewerId: string | null) {
  const query = viewerId ? `?viewer=${viewerId}` : ''
  return apiClient.get<EventDetail>(`/api/public/events/${id}${query}`).catch(() => null)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await load(id, null)
  if (!event) return { title: 'Event — SPLAT Connect' }
  return {
    title: `${event.title} — SPLAT Connect`,
    description: event.summary ?? undefined,
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  const event = await load(id, caps?.profile.id ?? null)
  if (!event) notFound()

  const badge = dateBadge(event.starts_at)
  const past = isPast(event.starts_at, event.ends_at)
  const closed = !!event.registrations_closed_at
  const cancelled = !!event.cancelled_at
  const full = event.seats_left === 0
  const where =
    event.format === 'online' ? 'Online' : [event.suburb, event.state].filter(Boolean).join(' ')

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 lg:order-2">
          <div className="card p-5">
            <p className="eyebrow text-muted">Hosted by</p>
            {event.org && (
              <Link
                href={`/organizations/${event.org.id}/public`}
                className="mt-2 flex items-center gap-3 hover:underline"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-tint font-display text-sm font-extrabold text-brand-deep"
                >
                  {event.org.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{event.org.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[event.org.suburb, event.org.state].filter(Boolean).join(' ')}
                  </span>
                </span>
              </Link>
            )}
          </div>

          <div className="card mt-4 p-5">
            <p className="eyebrow text-muted">Who is going</p>
            <div className="mt-2 flex items-center gap-2">
              {/* Initials, never names. See this file's own note. */}
              <div aria-hidden="true" className="flex -space-x-2">
                {event.attendee_initials.slice(0, 4).map((initials, i) => (
                  <span
                    key={`${initials}-${i}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-sunken text-[11px] font-extrabold text-brand-deep"
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted">
                {event.going_count} going
                {event.seats_left !== null && ` · ${event.seats_left} seats left`}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:order-1">
          <span className="badge bg-brand-tint text-brand-deep">
            {EVENT_KIND_LABEL[event.kind]}
          </span>
          <h1 className="mt-2 title-article">{event.title}</h1>

          {/* The four things, in decision order. */}
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-card bg-brand-tint text-brand-deep"
              >
                <span className="eyebrow leading-none">{badge.month}</span>
                <span className="font-display text-lg font-extrabold leading-tight">{badge.day}</span>
              </span>
              <span>
                <span className="block font-bold text-ink">{longDate(event.starts_at)}</span>
                <span className="block text-sm text-muted">
                  {formatTimeRange(event.starts_at, event.ends_at, event.format)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-sunken text-brand-deep"
              >
                <MapPin className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">
                  {event.format === 'online' ? 'Online' : event.location}
                </span>
                <span className="block text-sm text-muted">
                  {event.format === 'online'
                    ? 'The joining link is sent to you once you say you are coming.'
                    : `${where} · Free to attend`}
                </span>
              </span>
            </div>
          </div>

          <div className="card mt-6 p-5">
            {cancelled ? (
              <p className="font-bold text-danger">This event has been cancelled.</p>
            ) : past ? (
              <p className="font-bold text-muted">This one has already happened.</p>
            ) : (
              <>
                <p className="font-bold text-ink">
                  {full
                    ? 'This one is full'
                    : event.seats_left !== null
                      ? `${event.seats_left} seats left`
                      : 'Everyone is welcome'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {closed
                    ? 'The host has closed registrations for this one.'
                    : 'Saying you’re coming helps the host set out the right number of benches.'}
                </p>
                {!closed && !full && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <EventRsvpButton
                      eventId={event.id}
                      going={event.viewer_going}
                      signedIn={!!caps}
                      needsForm={event.questions.length > 0}
                      name={caps?.profile.name ?? undefined}
                      email={caps?.profile.email ?? undefined}
                    />
                    <a
                      href={`/events/${event.id}/calendar.ics`}
                      className="btn btn-quiet btn-sm"
                      download
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Add to calendar
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {event.description && (
            <section className="mt-8">
              <h2 className="title-detail">About this event</h2>
              {event.description.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                  {para}
                </p>
              ))}
            </section>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {event.audience && (
              <div className="card p-5">
                <p className="flex items-center gap-2 font-bold text-ink">
                  <Users className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                  Who it&apos;s for
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{event.audience}</p>
              </div>
            )}
            {event.what_to_bring && (
              <div className="card p-5">
                <p className="flex items-center gap-2 font-bold text-ink">
                  <Package className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                  What to bring
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{event.what_to_bring}</p>
              </div>
            )}
          </div>

          {(event.tools.length > 0 || event.prints_parts) && (
            <section className="card mt-4 p-5">
              <p className="flex items-center gap-2 font-bold text-ink">
                <Wrench className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                On the bench
              </p>
              {event.tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.tools.map((tool) => (
                    <span key={tool} className="badge bg-sunken text-brand-deep">
                      {tool}
                    </span>
                  ))}
                </div>
              )}
              {event.prints_parts && (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Printable parts can be printed for you before the day (up to{' '}
                  {event.part_sets_max} sets). Ask when you say you are coming, or via Get help
                  on the guide.
                </p>
              )}
            </section>
          )}

          {event.accessibility_note && (
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <Wheelchair className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
              {event.accessibility_note}
            </p>
          )}

          <p className="mt-8">
            <Link href="/get-involved/events" className="text-sm font-semibold text-brand-dark hover:underline">
              <CalendarDots className="mr-1 inline h-4 w-4" aria-hidden="true" />
              All events
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
