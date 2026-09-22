/**
 * My events — what you said you are going to, and where any part-print request
 * with the host is up to.
 *
 * Two things on one row, deliberately. The RSVP and the part request are
 * separate records with separate lifecycles, but a family thinks of them as one
 * Sunday: "am I going, and will my parts be there". Splitting them across two
 * screens would mean checking two places to answer one question.
 *
 * A declined print shows the NEXT STEP, not just the word — the artboard is
 * explicit about that, and it is the whole reason a decline carries a reason in
 * the database rather than living in the thread.
 *
 * Related files:
 * - packages/api/src/routes/events.ts: GET /events/mine, which joins the two
 * - app/dashboard/org/events/[id]/page.tsx: the host's side of that queue
 */
import Link from 'next/link'
import {
  CalendarBlank,
  CheckCircle,
  HourglassMedium,
  XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { dateBadge, formatTimeRange, isPast } from '@/lib/dates'
import type { EventKind, ToyTransactionStatus } from '@splat-connect/types'
import { CantMakeItButton } from './cant-make-it-button'

export const metadata = { title: 'My events — SPLAT Connect' }

type MyEvent = {
  registration_id: string
  registered_at: string
  event: {
    id: string
    org_id: string
    org_name: string
    kind: EventKind
    title: string
    starts_at: string
    ends_at: string | null
    format: 'in_person' | 'online'
    location: string | null
    suburb: string | null
    state: string | null
    cancelled_at: string | null
    prints_parts: boolean
  }
  part_request: {
    id: string
    status: ToyTransactionStatus
    part_sets: number | null
    decline_reason: string | null
  } | null
}

/**
 * Where a part request with the host is up to, in the board's words: the
 * host's name, then what they have said. A decline carries the next step
 * with it — a family told only "declined" has to work out for themselves that
 * a printer nearby is still an option, and most will not.
 */
function partsLine(request: MyEvent['part_request'], org: string) {
  if (!request) return null
  if (request.status === 'accepted') {
    return { bg: 'bg-success-soft', Icon: CheckCircle, text: `${org} is printing your parts`, declined: false }
  }
  if (request.status === 'requested') {
    return {
      bg: 'bg-honey-soft',
      Icon: HourglassMedium,
      text: `${org} has your part list — waiting for them to confirm`,
      declined: false,
    }
  }
  return {
    bg: 'bg-apricot-soft',
    Icon: XCircle,
    text: request.decline_reason
      ? `${org} cannot print your parts — ${request.decline_reason}`
      : `${org} cannot print your parts`,
    declined: true,
  }
}

function EventRow({ row, past }: { row: MyEvent; past: boolean }) {
  const badge = dateBadge(row.event.starts_at)
  const parts = partsLine(row.part_request, row.event.org_name)
  const where =
    row.event.format === 'online'
      ? 'Online'
      : [row.event.suburb, row.event.state].filter(Boolean).join(', ')
  return (
    <article className="card grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4 px-5 py-[18px] sm:grid-cols-[64px_minmax(0,1fr)_auto]">
      <span
        aria-hidden="true"
        className="grid place-items-center rounded-field bg-brand-tint py-2 text-ink"
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[.08em]">{badge.month}</span>
        <span className="font-display text-2xl font-extrabold leading-none">{badge.day}</span>
      </span>

      <div className="min-w-0">
        <h3 className="font-display text-lg font-extrabold text-ink">
          <Link href={`/get-involved/events/${row.event.id}`} className="hover:underline">
            {row.event.title}
          </Link>
          {row.event.cancelled_at && (
            <span className="badge ml-2 bg-danger-soft align-middle text-ink">Cancelled</span>
          )}
        </h3>
        <p className="mt-[3px] text-sm font-semibold text-muted">
          {row.event.org_name}
          {where && ` · ${where}`} ·{' '}
          {formatTimeRange(row.event.starts_at, row.event.ends_at, row.event.format)}
        </p>
        {parts && (
          <p
            className={`mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-field px-3 py-2 text-sm font-bold text-ink ${parts.bg}`}
          >
            <parts.Icon weight="fill" className="h-4 w-4 shrink-0" aria-hidden="true" />
            {parts.text}
            {parts.declined && (
              <Link href="/printing" className="ml-1 font-extrabold underline">
                Pick a printer →
              </Link>
            )}
          </p>
        )}
      </div>

      {!past && !row.event.cancelled_at && (
        <div className="col-span-2 sm:col-span-1">
          <CantMakeItButton eventId={row.event.id} />
        </div>
      )}
    </article>
  )
}

export default async function MyEventsPage() {
  await requireCapabilities()
  const rows = await apiClient.get<MyEvent[]>('/api/events/mine').catch(() => [] as MyEvent[])

  const upcoming = rows.filter((r) => !isPast(r.event.starts_at, r.event.ends_at))
  const past = rows.filter((r) => isPast(r.event.starts_at, r.event.ends_at))

  return (
    <div className="max-w-[900px]">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">My events</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-muted">
            What you said you are going to, and where any part-print request with the host is
            up to.
          </p>
        </div>
        <Link href="/get-involved/events" className="btn btn-quiet">
          All events
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="browse-empty mt-6 p-10">
          <div>
            <CalendarBlank
              weight="duotone"
              className="mx-auto h-10 w-10 text-muted"
              aria-hidden="true"
            />
            <p className="mb-1 mt-2.5 font-display text-xl font-extrabold text-ink">
              Nothing booked yet
            </p>
            <p className="text-[15px] text-muted">
              Build days are the fastest way to get a toy working. Find one, or ask for help on a
              guide.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3">
            {upcoming.map((row) => (
              <EventRow key={row.registration_id} row={row} past={false} />
            ))}
          </div>
          {/* The board samples only upcoming days; past ones keep their own
              heading so a finished Sunday never reads as still to come. */}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="title-section mb-3">Been and gone</h2>
              <div className="grid gap-3">
                {past.map((row) => (
                  <EventRow key={row.registration_id} row={row} past />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
