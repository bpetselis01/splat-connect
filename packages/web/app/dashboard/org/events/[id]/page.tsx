/**
 * Manage one event — the leader's side of the help pipeline.
 *
 * Two jobs on one screen, in the order they are urgent. First the part-print
 * requests, because each one has a family waiting on a yes or a no and a
 * declined request needs to be told early enough to find a printer instead.
 * Then who is coming, which is reference material for setting out the room.
 *
 * "You said up to 6 sets" counts SETS, not requests: that line is filament,
 * and six requests for one set each and one request for six are the same
 * amount of it.
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
import {
  CaretRight,
  ClipboardText,
  DownloadSimple,
  Eye,
} from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { longDate } from '@splat-connect/types'
import { formatRelativeTime } from '@/lib/relative-time'
import { EventPartQueue } from '@/components/event-part-queue'
import { EventWithdrawActions } from '@/components/event-withdraw-actions'
import { EventCostEditor } from '@/components/event-cost-editor'
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

  const answerText = (v: string | number | boolean | undefined) =>
    v === undefined || String(v).trim() === ''
      ? null
      : typeof v === 'boolean'
        ? v
          ? 'Yes'
          : 'No'
        : String(v)

  // The export is built here from rows this page already holds — the leader
  // policy that admits the answers is the only gate it needs.
  const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [
    ['Name', 'Email', 'Registered', ...questions.map((q) => q.prompt)],
    ...registrations.map((r) => [
      r.name,
      r.email,
      r.created_at,
      ...questions.map((q) => answerText(r.answers[q.id]) ?? ''),
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')

  const TINTS = ['bg-mint-soft', 'bg-honey-soft', 'bg-violet-soft', 'bg-brand-tint']

  const stats = [
    { label: 'Going', value: registrations.length, tint: 'bg-mint-soft' },
    { label: 'Part requests', value: partRequests.length, tint: 'bg-brand-tint' },
    { label: 'To answer', value: open.length, tint: 'bg-honey-soft' },
    { label: 'Seats', value: event.capacity ?? 'No limit', tint: 'bg-surface' },
  ]

  return (
    <div className="max-w-[980px]">
      <nav
        aria-label="Event"
        className="mb-3.5 flex items-center gap-2 text-sm font-bold text-muted"
      >
        <Link href="/dashboard/organisation/publish" className="text-muted hover:text-ink">
          Events and stories
        </Link>
        <CaretRight weight="bold" className="h-3 w-3" aria-hidden="true" />
        <span className="text-ink">{event.title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[.1em] text-muted">
            {EVENT_KIND_LABEL[event.kind]} · {longDate(event.starts_at)}
          </p>
          <h1 className="title-hub mt-2">{event.title}</h1>
        </div>
        {event.status === 'published' && (
          <Link
            href={`/get-involved/events/${event.id}`}
            className="btn btn-quiet min-h-11 px-4 text-sm"
          >
            <Eye weight="bold" aria-hidden="true" />
            View public page
          </Link>
        )}
      </div>

      <EventWithdrawActions
        orgId={org.id}
        eventId={event.id}
        registrationsClosed={!!event.registrations_closed_at}
        cancelled={!!event.cancelled_at}
      />

      <EventCostEditor
        orgId={org.id}
        eventId={event.id}
        costCents={event.cost_cents}
        costNote={event.cost_note}
      />

      <dl className="my-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`card-flat ${s.tint} px-5 py-[18px]`}>
            <dt className="text-xs font-extrabold uppercase tracking-[.1em] text-muted">
              {s.label}
            </dt>
            <dd className="mt-1.5 font-display text-[28px] font-extrabold tabular-nums text-ink">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {event.prints_parts && (
        <section>
          <h2 className="mb-1.5 font-display text-2xl font-extrabold text-ink">
            Parts to print before the day
          </h2>
          <p className="mb-4 max-w-[66ch] text-sm text-muted">
            Families who asked for help with a printable guide and chose “the host prints them”.
            Accept what you can; anyone you decline is told straight away and asked to pick a
            printer nearby instead. You said up to {event.part_sets_max} sets; {acceptedSets}{' '}
            accepted so far.
          </p>
          <EventPartQueue requests={partRequests} />
        </section>
      )}

      <section>
        <div className="mb-1.5 mt-9 flex flex-wrap items-end justify-between gap-3.5">
          <h2 className="font-display text-2xl font-extrabold text-ink">Who is coming</h2>
          <span className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/organisation/publish"
              className="btn btn-quiet min-h-11 px-3.5 text-sm"
            >
              <ClipboardText weight="bold" aria-hidden="true" />
              Edit the form
            </Link>
            {registrations.length > 0 && (
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
                download={`${event.title.replace(/[^\w -]+/g, '').trim() || 'event'} registrations.csv`}
                className="btn btn-quiet min-h-11 px-3.5 text-sm"
              >
                <DownloadSimple weight="bold" aria-hidden="true" />
                Export CSV
              </a>
            )}
          </span>
        </div>
        <p className="mb-3.5 text-sm text-muted">
          {registrations.length} registered · {questions.length} question
          {questions.length === 1 ? '' : 's'} on your form. Answers are shown to leaders only.
        </p>

        {registrations.length === 0 ? (
          <div className="browse-empty p-9 text-muted">Nobody has registered yet.</div>
        ) : (
          <div className="grid gap-2.5">
            {registrations.map((r, i) => (
              <article
                key={r.id}
                className="card-flat flex flex-col gap-3 px-[18px] py-4 shadow-e1"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-ink ${TINTS[i % TINTS.length]}`}
                  >
                    {r.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                  <span className="font-extrabold text-ink">{r.name}</span>
                  <span className="text-[13px] font-semibold text-muted">
                    registered {formatRelativeTime(r.created_at)}
                  </span>
                </div>

                {questions.length > 0 && (
                  <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
                    {questions.map((q) => {
                      const a = answerText(r.answers[q.id])
                      return (
                        <div key={q.id} className="min-w-0 rounded-field bg-sunken px-3.5 py-2.5">
                          <dt className="text-xs font-extrabold uppercase tracking-[.06em] text-muted">
                            {q.prompt}
                          </dt>
                          <dd
                            className={`mt-1 text-[15px] font-semibold leading-[1.45] ${a ? 'text-ink' : 'text-muted'}`}
                          >
                            {a ?? '—'}
                          </dd>
                        </div>
                      )
                    })}
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
