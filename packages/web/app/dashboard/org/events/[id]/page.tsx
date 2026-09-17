/**
 * Manage one event — the leader's side of the help pipeline.
 *
 * Two jobs on one screen, in the order they are urgent. First the part-print
 * requests, because each one has a family waiting on a yes or a no and a
 * declined request needs to be told early enough to find a printer instead.
 * Then who is coming, which is reference material for setting out the room.
 *
 * The four numbers at the top are counted in SETS, not requests, wherever sets
 * are the unit — "You said up to 6 sets" is filament, and six requests for one
 * set each and one request for six are the same amount of it.
 *
 * Answers render here and nowhere else. 061's leader-read policy is what admits
 * them, and scripts/check-schema-guards.sh asserts that no anon policy can.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: the event, its questions, its
 *   registrations
 * - packages/api/src/routes/toy-transactions.ts: accept and reject, which this
 *   reuses unchanged — an event's part request is an ordinary print job
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Printer, Users, ArrowSquareOut, PencilSimple } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { longDate } from '@/lib/event-dates'
import { formatRelativeTime } from '@/lib/relative-time'
import { EventPartQueue } from '@/components/event-part-queue'
import { EventWithdrawActions } from '@/components/event-withdraw-actions'
import {
  EVENT_KIND_LABEL,
  type OrgEvent,
  type OrgEventQuestion,
  type OrgEventRegistration,
  type ToyTransactionSummary,
} from '@splat-connect/types'

export const metadata = { title: 'Manage event — SPLAT Connect' }

export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  const [events, questions, registrations, inbox] = await Promise.all([
    apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`).catch(() => [] as OrgEvent[]),
    apiClient
      .get<OrgEventQuestion[]>(`/api/organizations/${org.id}/events/${id}/questions`)
      .catch(() => [] as OrgEventQuestion[]),
    apiClient
      .get<OrgEventRegistration[]>(`/api/organizations/${org.id}/events/${id}/registrations`)
      .catch(() => [] as OrgEventRegistration[]),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
      .catch(() => [] as ToyTransactionSummary[]),
  ])

  const event = events.find((e) => e.id === id)
  if (!event) notFound()

  const partRequests = inbox.filter((t) => t.event_id === id)
  const open = partRequests.filter((t) => t.status === 'requested')
  const acceptedSets = partRequests
    .filter((t) => t.status === 'accepted')
    .reduce((n, t) => n + (t.part_sets ?? 0), 0)

  const prompts = new Map(questions.map((q) => [q.id, q.prompt]))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">
            {EVENT_KIND_LABEL[event.kind]} · {longDate(event.starts_at)}
          </p>
          <h1 className="mt-1 title-article">{event.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === 'published' && (
            <Link href={`/get-involved/events/${event.id}`} className="btn btn-quiet btn-sm">
              <ArrowSquareOut className="h-4 w-4" aria-hidden="true" />
              View public page
            </Link>
          )}
          <Link href="/dashboard/organisation/publish" className="btn btn-quiet btn-sm">
            <PencilSimple className="h-4 w-4" aria-hidden="true" />
            Events and stories
          </Link>
        </div>
      </div>

      <EventWithdrawActions
        orgId={org.id}
        eventId={event.id}
        registrationsClosed={!!event.registrations_closed_at}
        cancelled={!!event.cancelled_at}
      />

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Going', value: registrations.length },
          { label: 'Part requests', value: partRequests.length },
          { label: 'To answer', value: open.length },
          {
            label: 'Seats',
            value: event.capacity === null ? '—' : Math.max(0, event.capacity - registrations.length),
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="eyebrow text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {event.prints_parts && (
        <section className="mt-8">
          <h2 className="title-detail flex items-center gap-2">
            <Printer className="h-5 w-5 text-brand-dark" aria-hidden="true" />
            Parts to print before the day
          </h2>
          <p className="mb-4 mt-1 max-w-prose text-sm leading-relaxed text-muted">
            Families who asked for help with a printable guide and chose “the host prints them”.
            Accept what you can; anyone you decline is told straight away and asked to pick a
            printer nearby instead. You said up to {event.part_sets_max} sets; {acceptedSets}{' '}
            accepted so far.
          </p>
          <EventPartQueue requests={partRequests} />
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="title-detail flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-dark" aria-hidden="true" />
            Who is coming
          </h2>
          <Link href="/dashboard/organisation/publish" className="btn btn-quiet btn-sm">
            Edit the form
          </Link>
        </div>
        <p className="mb-4 mt-1 text-sm text-muted">
          {registrations.length} registered · {questions.length} question
          {questions.length === 1 ? '' : 's'} on your form. Answers are shown to leaders only.
        </p>

        {registrations.length === 0 ? (
          <p className="card p-5 text-sm text-muted">
            Nobody yet. Registrations appear here the moment somebody taps I&apos;m going.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {registrations.map((r) => (
              <article key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-extrabold text-brand-deep"
                  >
                    {r.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                  <span className="font-bold text-ink">{r.name}</span>
                  <span className="text-xs text-muted">
                    registered {formatRelativeTime(r.created_at)}
                  </span>
                </div>

                {Object.keys(r.answers).length > 0 && (
                  <dl className="mt-3 grid gap-3 pl-12 sm:grid-cols-2">
                    {questions.map((q) =>
                      r.answers[q.id] === undefined ? null : (
                        <div key={q.id}>
                          <dt className="text-xs font-bold text-muted">
                            {prompts.get(q.id) ?? q.prompt}
                          </dt>
                          <dd className="mt-0.5 text-sm text-ink">
                            {typeof r.answers[q.id] === 'boolean'
                              ? r.answers[q.id]
                                ? 'Yes'
                                : 'No'
                              : String(r.answers[q.id])}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
