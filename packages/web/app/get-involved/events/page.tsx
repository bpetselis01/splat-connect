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
import { CalendarDots, Buildings } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { EventCard } from '@/components/event-card'
import { Disclosure } from '@/components/disclosure'
import { monthHeading, monthKey, isPast } from '@/lib/event-dates'
import { AU_STATES, type EventListItem } from '@splat-connect/types'

export const metadata = {
  title: 'Events — SPLAT Connect',
  description:
    'Build days, workshops and open afternoons run by the organisations on SPLAT. No ticket price.',
}

const FORMATS = [
  { value: '', label: 'All' },
  { value: 'in_person', label: 'In person' },
  { value: 'online', label: 'Online' },
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="title-hub">Events</h1>
          <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
            Build days, workshops and open afternoons run by the organisations on SPLAT. No
            ticket price — a few ask you to cover materials, and the amount is on the event
            before you register.
          </p>
        </div>
      </div>

      {/* Links, not buttons: a filtered list is a place, and a family who finds
          a Saturday in Brighton should be able to send that page to someone. */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div role="tablist" aria-label="Format" className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <Link
              key={f.label}
              role="tab"
              aria-selected={format === f.value}
              href={href({ format: f.value })}
              className="chip"
              data-selected={format === f.value ? 'true' : undefined}
              aria-pressed={format === f.value}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="State">
          <Link href={href({ state: '' })} className="chip" aria-pressed={state === ''}>
            Anywhere
          </Link>
          {AU_STATES.map((s) => (
            <Link key={s} href={href({ state: s })} className="chip" aria-pressed={state === s}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-10 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <CalendarDots className="h-8 w-8" />
          </span>
          <p className="mt-4 font-display text-xl font-extrabold text-ink">
            Nothing coming up here yet
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {format || state
              ? 'Try Anywhere, or the All tab — an online workshop is open to everyone wherever it is run from.'
              : 'Organisations publish build days straight to this page. Nothing is scheduled right now.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {byMonth(upcoming).map((group) => (
            <section key={group.key}>
              <h2 className="title-detail mb-3">{group.heading}</h2>
              <div className="flex flex-col gap-3">
                {group.events.map((e) => (
                  <EventCard key={e.id} event={e} signedIn={!!caps} hasQuestions={e.has_questions} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-10">
          <Disclosure summary={`Past events (${past.length})`}>
            <div className="flex flex-col gap-3 pt-3">
              {past.map((e) => (
                <EventCard key={e.id} event={e} signedIn={!!caps} hasQuestions={e.has_questions} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      <aside className="card mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
        <span aria-hidden="true" className="empty-badge shrink-0 text-brand-deep">
          <Buildings className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-extrabold text-ink">
            Run a therapy service, school or makerspace?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Organisation leaders publish events straight to this page from their dashboard.
            Families see them the moment you press publish.
          </p>
        </div>
        <Link href="/get-involved/organisations/request" className="btn btn-quiet btn-sm shrink-0">
          Register your organisation
        </Link>
      </aside>
    </div>
  )
}
