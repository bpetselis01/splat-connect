/**
 * Events — build days, workshops and open afternoons the organisations run.
 *
 * Grouped by month, soonest first, because the question a family brings here is
 * "is there one I can get to" and the answer is a date. Past events fold away
 * into a disclosure rather than disappearing: a first-time visitor reading an
 * empty list cannot tell whether nothing is planned or nothing ever happens,
 * and three past build days answer that in a way a paragraph cannot.
 *
 * Two filters, both the artboard's. Format is a tab strip; state is a chip row,
 * and an ONLINE event shows under every state — a workshop on a video call is
 * as reachable from Wagga as from Crows Nest, and hiding it under "NSW" would
 * be the filter lying about what it excludes.
 *
 * Related files:
 * - components/event-card.tsx: one row
 * - packages/api/src/routes/public.ts: GET /public/events, which does the
 *   filtering in SQL so a state filter never ships rows it will not draw
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  CalendarPlus,
  CalendarX,
  CaretDown,
  ListBullets,
  MapPin,
  Megaphone,
  Plus,
  VideoCamera,
} from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { EventCard, PastEventRow } from '@/components/event-card'
import { monthHeading, monthKey, isPast } from '@/lib/dates'
import { AU_STATES, type EventListItem } from '@splat-connect/types'

export const metadata = {
  title: 'Events — SPLAT Connect',
  description:
    'Build days, workshops and open afternoons run by the organisations on SPLAT. No ticket price.',
}

const FORMATS = [
  { value: '', label: 'All', icon: ListBullets },
  { value: 'in_person', label: 'In person', icon: MapPin },
  { value: 'online', label: 'Online', icon: VideoCamera },
] as const

/** Month → the events in it, in date order, with the months in date order. */
function byMonth(events: EventListItem[]): Array<{ key: string; heading: string; events: EventListItem[] }> {
  const groups = new Map<string, EventListItem[]>()
  for (const e of events) {
    const key = monthKey(e.starts_at)
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, heading: monthHeading(list[0].starts_at), events: list }))
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; state?: string }>
}) {
  const { format = '', state = '' } = await searchParams
  const caps = await getCapabilities()

  const query = new URLSearchParams()
  if (format === 'in_person' || format === 'online') query.set('format', format)
  if ((AU_STATES as readonly string[]).includes(state)) query.set('state', state)
  // The viewer id only ever decides whether a card reads "I'm going" or
  // "You're going" — see the route's own note on why it is a query parameter
  // rather than a session.
  if (caps) query.set('viewer', caps.profile.id)

  const all = await apiClient
    .get<EventListItem[]>(`/api/public/events?${query}`)
    .catch(() => [] as EventListItem[])

  const upcoming = all.filter((e) => !isPast(e.starts_at, e.ends_at))
  const past = all.filter((e) => isPast(e.starts_at, e.ends_at)).reverse()

  // Typed as the literal route with an optional query, because typedRoutes
  // rejects a bare `string` href — a plain return type here is the one thing
  // that would let a filter link point at a route that does not exist.
  const href = (next: { format?: string; state?: string }): Route => {
    const p = new URLSearchParams()
    const f = next.format ?? format
    const s = next.state ?? state
    if (f) p.set('format', f)
    if (s) p.set('state', s)
    const q = p.toString()
    return (q ? `/get-involved/events?${q}` : '/get-involved/events') as Route
  }

  const leads = (caps?.ledOrgs.length ?? 0) > 0
  // The API's feed of every published event. webcal:// hands it to the
  // calendar app as a subscription rather than a one-off download; the plain
  // http(s) link is for the apps that only take a pasted URL.
  const feed = `${process.env.NEXT_PUBLIC_API_URL}/api/public/events.ics`
  const webcal = feed.replace(/^https?:/, 'webcal:')

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-[62ch]">
          <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">
            Get involved
          </span>
          <h1 className="mt-2.5 font-display text-[clamp(34px,4vw,52px)] font-extrabold leading-[1.05] tracking-[-.02em] text-ink">
            Events
          </h1>
          <p className="mt-3.5 text-lg leading-[1.6] text-muted [text-wrap:pretty]">
            Build days, workshops and open afternoons run by the organisations on SPLAT. No
            ticket price — a few ask you to cover materials, and the amount is on the event
            before you register.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2.5">
            <a
              href={webcal}
              className="btn min-h-12 border-line bg-[var(--surface)] px-5 text-[15px] text-ink shadow-[var(--e1)]"
            >
              <CalendarPlus weight="bold" aria-hidden="true" /> Subscribe to calendar
            </a>
            {leads && (
              <Link href="/dashboard/organisation/events/new" className="btn btn-primary min-h-12 px-5 text-[15px]">
                <Plus weight="bold" aria-hidden="true" /> Host an event
              </Link>
            )}
          </div>
          <a href={feed} className="text-[13px] font-bold text-muted underline">
            Or copy the feed link
          </a>
        </div>
      </div>

      {/* Links, not buttons: a filtered list is a place, and a family who finds
          a Saturday in Brighton should be able to send that page to someone. */}
      <div className="mb-2 mt-[30px] flex flex-wrap items-center gap-3.5">
        <div
          role="tablist"
          aria-label="Format"
          className="inline-flex rounded-full border border-line bg-[var(--surface2)] p-1"
        >
          {FORMATS.map((f) => {
            const on = format === f.value
            return (
              <Link
                key={f.label}
                role="tab"
                // aria-selected, not aria-pressed: role="tab" does not support
                // the latter, and two conflicting states read worse than one.
                aria-selected={on}
                href={href({ format: f.value })}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold ${
                  on ? 'bg-[var(--surface)] text-ink shadow-[var(--e1)]' : 'text-muted'
                }`}
              >
                <f.icon weight="bold" aria-hidden="true" />
                {f.label}
              </Link>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="State">
          {['', ...AU_STATES].map((s) => {
            const on = state === s
            return (
              <Link
                key={s || 'any'}
                href={href({ state: s })}
                aria-pressed={on}
                className={`inline-flex min-h-11 items-center rounded-full border-2 px-3.5 text-[13px] font-extrabold text-ink ${
                  on ? 'border-[var(--b600)] bg-[var(--b100)]' : 'border-line bg-[var(--surface)]'
                }`}
              >
                {s || 'Anywhere'}
              </Link>
            )
          })}
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="mt-7 rounded-card border border-dashed border-line bg-[var(--surface)] p-10 text-center">
          <CalendarX weight="duotone" aria-hidden="true" className="mx-auto text-[40px] text-muted" />
          <p className="mb-1 mt-2.5 font-display text-xl font-extrabold text-ink">
            Nothing coming up here yet
          </p>
          <p className="text-[15px] text-muted">
            {format || state
              ? 'Try another state, or switch to online sessions — anyone can join those.'
              : 'Organisations publish build days straight to this page. Nothing is scheduled right now.'}
          </p>
        </div>
      ) : (
        byMonth(upcoming).map((group) => (
          <section key={group.key}>
            <h2 className="mb-3.5 mt-[34px] flex items-center gap-3 font-display text-[22px] font-extrabold text-ink">
              {group.heading}
              <span aria-hidden="true" className="h-0.5 flex-1 rounded-sm bg-[var(--line)]" />
            </h2>
            <div className="grid gap-3">
              {group.events.map((e) => (
                <EventCard key={e.id} event={e} signedIn={!!caps} hasQuestions={e.has_questions} />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="mt-11 grid items-start gap-5 md:grid-cols-2">
        <div>
          {past.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
                <CaretDown weight="bold" aria-hidden="true" className="-rotate-90 transition-transform group-open:rotate-0" />
                {/* A heading, not summary text: the board's section is one, and
                    a reader jumping by heading should land on it. */}
                <h3 className="font-display text-[22px] font-extrabold text-ink">
                  Past events <span className="font-sans text-sm font-bold text-muted">({past.length})</span>
                </h3>
              </summary>
              <div className="mt-3.5 grid gap-2">
                {past.map((e) => (
                  <PastEventRow key={e.id} event={e} />
                ))}
              </div>
            </details>
          )}
        </div>
        <aside className="flex items-start gap-4 rounded-card border border-line bg-[var(--tviolet)] p-6 text-[var(--tink)]">
          <Megaphone weight="duotone" aria-hidden="true" className="shrink-0 text-[32px]" />
          <div>
            <p className="font-display text-[19px] font-extrabold">
              Run a therapy service, school or makerspace?
            </p>
            <p className="mb-3 mt-1.5 text-sm leading-[1.5]">
              Organisation leaders publish events straight to this page from their dashboard.
              Families see them the moment you press publish.
            </p>
            <Link
              href={leads ? '/dashboard/organisation/events/new' : '/get-involved/organisations/request'}
              className="btn min-h-11 bg-ink px-4 text-sm text-[var(--surface)]"
            >
              {leads ? 'Host an event' : 'Register your organisation'} <ArrowRight weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
