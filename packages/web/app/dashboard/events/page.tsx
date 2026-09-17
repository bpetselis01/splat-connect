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
import { CalendarCheck, Printer, Warning } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { dateBadge, formatTimeRange, isPast } from '@/lib/dates'
import { Badge } from '@/components/badge'
import { EVENT_KIND_LABEL, type EventKind, type ToyTransactionStatus } from '@splat-connect/types'

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

/** What a family should do next about their parts, in one sentence. */
function partsLine(request: MyEvent['part_request'], eventId: string) {
  if (!request) return null
  if (request.status === 'accepted') {
    return {
      tone: 'ok' as const,
      text: `The host is printing ${request.part_sets} set${request.part_sets === 1 ? '' : 's'} before the day.`,
      action: null,
    }
  }
  if (request.status === 'requested') {
    return {
      tone: 'pending' as const,
      text: 'Waiting on the host to say whether they can print these.',
      action: null,
    }
  }
  // Declined. The reason and the way forward, together — a family told only
  // "declined" has to work out for themselves that a printer nearby is still
  // an option, and most will not.
  return {
    tone: 'bad' as const,
    text: request.decline_reason
      ? `The host cannot print these — ${request.decline_reason}`
      : 'The host cannot print these.',
    action: { href: '/printing' as const, label: 'Find a printer nearby' },
  }
}

export default async function MyEventsPage() {
  await requireCapabilities()
  const rows = await apiClient.get<MyEvent[]>('/api/events/mine').catch(() => [] as MyEvent[])

  const upcoming = rows.filter((r) => !isPast(r.event.starts_at, r.event.ends_at))
  const past = rows.filter((r) => isPast(r.event.starts_at, r.event.ends_at))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="title-hub">My events</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            What you said you are going to, and where any part-print request with the host is
            up to.
          </p>
        </div>
        <Link href="/get-involved/events" className="btn btn-quiet btn-sm">
          All events
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <CalendarCheck className="h-8 w-8" />
          </span>
          <p className="mt-4 font-display text-xl font-extrabold text-ink">Nothing booked yet</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Build days are the fastest way to get a toy working. Find one, or ask for help on a
            guide.
          </p>
          <Link href="/get-involved/events" className="btn btn-primary btn-sm mt-4">
            Find a build day
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[
            { label: 'Coming up', list: upcoming },
            { label: 'Been and gone', list: past },
          ]
            .filter((g) => g.list.length > 0)
            .map((group) => (
              <section key={group.label}>
                <h2 className="title-detail mb-3">{group.label}</h2>
                <div className="flex flex-col gap-3">
                  {group.list.map((row) => {
                    const badge = dateBadge(row.event.starts_at)
                    const parts = partsLine(row.part_request, row.event.id)
                    const where =
                      row.event.format === 'online'
                        ? 'Online'
                        : [row.event.suburb, row.event.state].filter(Boolean).join(', ')
                    return (
                      <article key={row.registration_id} className="card p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <span
                            aria-hidden="true"
                            className="flex h-[66px] w-[66px] shrink-0 flex-col items-center justify-center rounded-card bg-brand-tint text-brand-deep"
                          >
                            <span className="eyebrow leading-none">{badge.weekday}</span>
                            <span className="font-display text-xl font-extrabold leading-tight">
                              {badge.day}
                            </span>
                            <span className="eyebrow leading-none">{badge.month}</span>
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge bg-brand-tint text-brand-deep">
                                {EVENT_KIND_LABEL[row.event.kind]}
                              </span>
                              {row.event.cancelled_at && (
                                <span className="badge bg-danger-soft text-ink">Cancelled</span>
                              )}
                            </div>
                            <h3 className="mt-1.5 font-display text-lg font-extrabold text-ink">
                              <Link
                                href={`/get-involved/events/${row.event.id}`}
                                className="hover:underline"
                              >
                                {row.event.title}
                              </Link>
                            </h3>
                            <p className="mt-1 text-sm text-muted">
                              {formatTimeRange(
                                row.event.starts_at,
                                row.event.ends_at,
                                row.event.format,
                              )}{' '}
                              · {where} · {row.event.org_name}
                            </p>
                          </div>
                        </div>

                        {parts && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-sunken px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                              {parts.tone === 'bad' ? (
                                <Warning className="h-4 w-4 text-danger" aria-hidden="true" />
                              ) : (
                                <Printer className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                              )}
                              Parts
                            </span>
                            <Badge
                              status={
                                parts.tone === 'ok'
                                  ? 'accepted'
                                  : parts.tone === 'pending'
                                    ? 'requested'
                                    : 'rejected'
                              }
                            />
                            <span className="min-w-0 flex-1 text-sm text-muted">{parts.text}</span>
                            {parts.action && (
                              <Link href={parts.action.href} className="btn btn-quiet btn-sm">
                                {parts.action.label}
                              </Link>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
