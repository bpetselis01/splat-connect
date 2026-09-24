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
import Image from 'next/image'
import {
  ArrowRight,
  Backpack,
  CalendarPlus,
  Image as ImageIcon,
  MapPin,
  Printer,
  Toolbox,
  Users,
  VideoCamera,
  Wheelchair,
  XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { safePhotoSrc } from '@/lib/photo-src'
import { EventRsvpButton } from '@/components/event-rsvp-button'
import { EventCostPanel } from '@/components/event-cost-panel'
import { KIND_TINT } from '@/components/event-card'
import { ShareButton } from '@/components/share-button'
import { longDate, formatTimeRange, dateBadge, isPast } from '@splat-connect/types'
import {
  EVENT_KIND_LABEL,
  formatCents,
  type EventListItem,
  type OrgEventQuestion,
} from '@splat-connect/types'

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
  const online = event.format === 'online'
  const where = online ? 'Online' : [event.suburb, event.state].filter(Boolean).join(' ')
  const tint = KIND_TINT[event.kind]
  const cover = safePhotoSrc(event.photo_urls[0] ?? null)
  // 069. The where line and the cost panel agree: a costed event never says
  // "Free to attend" beside a figure.
  const costLine = event.cost_cents ? `${formatCents(event.cost_cents)} towards materials` : 'Free to attend'
  const faceTints = ['var(--tcoral)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)']
  const going = `${event.going_count} going${event.seats_left !== null ? ` · ${event.seats_left} seats left` : ''}`
  const LABEL = 'text-xs font-extrabold uppercase tracking-[.1em] text-muted'

  return (
    <div className="max-w-[1080px]">
      <div className="grid items-start gap-9 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div
            className="relative grid aspect-square place-items-center overflow-hidden rounded-card border border-line shadow-[var(--e2),var(--hi)]"
            style={{ background: tint }}
          >
            {cover ? (
              <Image src={cover} alt="" fill className="object-cover" />
            ) : (
              <ImageIcon weight="duotone" aria-hidden="true" className="text-5xl text-[var(--tink)] opacity-50" />
            )}
          </div>

          {event.org && (
            <div className="rounded-[18px] border border-line bg-[var(--surface)] px-5 py-[18px] shadow-[var(--e1)]">
              <p className={`${LABEL} mb-2.5`}>Hosted by</p>
              <Link href={`/organizations/${event.org.id}/public`} className="flex w-full items-center gap-3 text-ink">
                <span
                  aria-hidden="true"
                  className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] text-[15px] font-extrabold text-[var(--tink)]"
                  style={{ background: tint }}
                >
                  {event.org.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-extrabold">{event.org.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {[event.org.suburb, event.org.state].filter(Boolean).join(' ')}
                  </span>
                </span>
                <ArrowRight weight="bold" aria-hidden="true" className="text-muted" />
              </Link>
            </div>
          )}

          <div className="rounded-[18px] border border-line bg-[var(--surface)] px-5 py-[18px] shadow-[var(--e1)]">
            <p className={`${LABEL} mb-2`}>Who is going</p>
            <div className="flex items-center gap-2.5">
              {/* Initials, never names. See this file's own note. */}
              {event.attendee_initials.length > 0 && (
                <span aria-hidden="true" className="flex pl-2">
                  {event.attendee_initials.slice(0, 4).map((initials, i) => (
                    <span
                      key={`${initials}-${i}`}
                      className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--surface)] text-[11px] font-extrabold text-[var(--tink)]"
                      style={{ background: faceTints[i % faceTints.length] }}
                    >
                      {initials}
                    </span>
                  ))}
                </span>
              )}
              <span className="text-sm font-bold">{going}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[.06em] text-[var(--tink)]"
              style={{ background: tint }}
            >
              {EVENT_KIND_LABEL[event.kind]}
            </span>
            {past && (
              <span className="rounded-full border border-line bg-[var(--surface2)] px-3 py-1 text-xs font-extrabold uppercase tracking-[.06em] text-muted">
                Past event
              </span>
            )}
          </span>
          <h1 className="mt-3 font-display text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink [text-wrap:balance]">
            {event.title}
          </h1>

          {/* The four things, in decision order. */}
          <div className="mt-[22px] grid gap-3">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-line bg-[var(--surface)]"
              >
                <span className="grid place-items-center">
                  <span className="text-[9px] font-extrabold uppercase text-[var(--coral)]">{badge.month}</span>
                  <span className="font-display text-lg font-extrabold leading-none">{badge.day}</span>
                </span>
              </span>
              <span>
                <span className="block text-base font-extrabold">{longDate(event.starts_at)}</span>
                <span className="block text-sm text-muted">
                  {formatTimeRange(event.starts_at, event.ends_at, event.format)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-line bg-[var(--surface)]"
              >
                {online ? (
                  <VideoCamera weight="duotone" className="text-2xl text-[var(--b600)]" />
                ) : (
                  <MapPin weight="duotone" className="text-2xl text-[var(--b600)]" />
                )}
              </span>
              <span>
                <span className="block text-base font-extrabold">{online ? 'Online' : event.location}</span>
                <span className="block text-sm text-muted">
                  {online
                    ? 'The joining link is sent to you once you say you are coming.'
                    : `${where} · ${costLine}`}
                </span>
              </span>
            </div>
          </div>

          <div className="card mt-6 px-[22px] py-5">
            {cancelled && (
              <p className="mb-3.5 flex items-center gap-2 rounded-[14px] bg-[var(--tcoral)] px-3.5 py-3 font-extrabold text-[var(--tink)]">
                <XCircle weight="fill" aria-hidden="true" /> Cancelled by the host
              </p>
            )}
            {cancelled ? null : past ? (
              <p className="font-display text-lg font-extrabold text-muted">This one has already happened.</p>
            ) : (
              <>
                <p className="mb-1 font-display text-lg font-extrabold">
                  {full
                    ? 'This one is full'
                    : event.seats_left !== null
                      ? `${event.seats_left} seats left`
                      : 'Everyone is welcome'}
                </p>
                <p className="mb-3.5 text-sm leading-[1.5] text-muted">
                  {closed
                    ? 'The host has closed registrations for this one.'
                    : 'Saying you’re coming helps the host set out the right number of benches.'}
                </p>
                {!closed && !full && (
                  <div className="flex flex-wrap gap-2.5">
                    <EventRsvpButton
                      eventId={event.id}
                      going={event.viewer_going}
                      signedIn={!!caps}
                      needsForm={event.questions.length > 0}
                      name={caps?.profile.name ?? undefined}
                      email={caps?.profile.email ?? undefined}
                      size="lg"
                    />
                    <a
                      href={`/events/${event.id}/calendar.ics`}
                      className="btn min-h-[52px] border-line bg-[var(--surface)] px-[18px] text-ink"
                      download
                    >
                      <CalendarPlus weight="bold" aria-hidden="true" />
                      Add to calendar
                    </a>
                    <ShareButton title={event.title} copyLink className="min-h-[52px]" />
                  </div>
                )}
              </>
            )}
          </div>

          <EventCostPanel
            orgName={event.org?.name ?? 'The host'}
            costCents={event.cost_cents}
            costNote={event.cost_note}
            className="mt-4"
          />

          <div className="mt-[34px] flex max-w-[66ch] flex-col gap-[26px]">
            {event.description && (
              <div>
                <h2 className="mb-2.5 font-display text-[22px] font-extrabold">About this event</h2>
                {event.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="mb-3 text-[16.5px] leading-[1.65]">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {(event.audience || event.what_to_bring) && (
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                {event.audience && (
                  <div className="rounded-[18px] bg-[var(--tmint)] px-5 py-[18px] text-[var(--tink)]">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[.08em]">
                      <Users weight="bold" aria-hidden="true" /> Who it&apos;s for
                    </p>
                    <p className="text-[15px] leading-[1.55]">{event.audience}</p>
                  </div>
                )}
                {event.what_to_bring && (
                  <div className="rounded-[18px] bg-[var(--tamber)] px-5 py-[18px] text-[var(--tink)]">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[.08em]">
                      <Backpack weight="bold" aria-hidden="true" /> What to bring
                    </p>
                    <p className="text-[15px] leading-[1.55]">{event.what_to_bring}</p>
                  </div>
                )}
              </div>
            )}

            {(event.tools.length > 0 || event.prints_parts) && (
              <section className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-[var(--surface)] px-5 py-[18px]">
                <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[.08em] text-muted">
                  <Toolbox weight="bold" aria-hidden="true" /> On the bench
                </p>
                {event.tools.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {event.tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full border border-line bg-[var(--surface2)] px-3 py-[5px] text-[13px] font-bold"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                {event.prints_parts && (
                  <p className="flex items-start gap-1.5 text-sm leading-[1.5]">
                    <Printer weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--b600)]" />
                    Printable parts can be printed for you before the day (up to{' '}
                    {event.part_sets_max} sets). Ask when you say you are coming, or via Get help on
                    the guide.
                  </p>
                )}
              </section>
            )}

            {event.accessibility_note && (
              <p className="flex items-start gap-2 rounded-[18px] bg-[var(--surface2)] px-[18px] py-3.5 text-sm leading-[1.5] text-muted">
                <Wheelchair weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-ink" />
                {event.accessibility_note}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
