/**
 * Requests to your organisation — every ask a family can make, in one queue.
 *
 * Three shapes arrive here and they are one table (toy_transactions), which is
 * why they can share a screen at all: a family asking for a toy the
 * organisation holds, asking the organisation to build a guide, and asking it
 * to print parts. The leader's question is the same for all three — can we do
 * this — so splitting them across three screens would mean checking three
 * places to answer it once.
 *
 * Deliberately NOT the tutorial review queue at /dashboard/organisation. That
 * is a different question (is this guide good enough to put our name on) asked
 * of a different thing, and merging the two would put "approve and publish"
 * next to "we can print those".
 *
 * The rows link to the thread rather than acting here. Accepting a toy request
 * needs a pickup address, accepting a print needs a bed check, and declining a
 * print needs a reason — the thread is where each of those lives, and a button
 * here that skipped them would be the fast path to a wrong answer.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Gift, Hammer, Cube, BookOpenText } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { formatRelativeTime } from '@/lib/relative-time'
import { subjectName, type ToyTransactionSummary } from '@splat-connect/types'

export const metadata = { title: 'Requests to your organisation — SPLAT Connect' }

/*
 * The board's segmented tabs, one per shape. Its own three are "Host a build
 * day", "Print for an event" and "Builds nearby"; the first and last have no
 * record behind them yet, so the tabs are the three shapes toy_transactions
 * actually carries, in the board's form.
 */
const TABS = [
  {
    key: 'toys',
    label: 'Lend a toy',
    icon: Gift,
    types: ['donation', 'exchange'],
    lead: 'Families asking for a toy on your shelf, or offering one in swap. Accepting asks where they collect it.',
    empty: 'No toy requests right now.',
  },
  {
    key: 'parts',
    label: 'Print parts',
    icon: Cube,
    types: ['print'],
    lead: 'Families asking your printers for parts. Accepting checks the bed and the material first.',
    empty: 'No part requests yet.',
  },
  {
    key: 'builds',
    label: 'Build a guide',
    icon: Hammer,
    types: ['build'],
    lead: 'Families asking your organisation to build a guide for them. It then runs through your exchanges.',
    empty: 'No build requests right now.',
  },
] as const

type TabKey = (typeof TABS)[number]['key']

export default async function OrgRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const { tab } = await searchParams

  const all = await apiClient
    .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
    .catch(() => [] as ToyTransactionSummary[])

  // The organisation's, not the leader's own. A leader who also gives toys
  // personally has both in that list, and only one of them is this queue.
  // Finished records leave the queue; they live on in the exchanges list.
  const ledIds = new Set(caps.ledOrgs.map((o) => o.id))
  const mine = all.filter(
    (t) =>
      t.owner_org_id &&
      ledIds.has(t.owner_org_id) &&
      (t.status === 'requested' || t.status === 'accepted'),
  )

  const rowsFor = (key: TabKey) => {
    const types: readonly string[] = TABS.find((t) => t.key === key)!.types
    // Waiting on you first, then what is under way.
    return mine
      .filter((t) => types.includes(t.type))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'requested' ? -1 : 1))
  }
  const pending = (key: TabKey) => rowsFor(key).filter((t) => t.status === 'requested').length

  // An explicit ?tab wins; otherwise open on whatever is waiting.
  const current =
    TABS.find((t) => t.key === tab) ??
    TABS.find((t) => pending(t.key) > 0) ??
    TABS.find((t) => rowsFor(t.key).length > 0) ??
    TABS[0]
  const rows = rowsFor(current.key)

  return (
    <div className="max-w-[980px]">
      <h1 className="title-hub">Requests to {caps.ledOrgs[0].name}</h1>
      <p className="mb-[22px] mt-2 max-w-[64ch] text-[15px] text-muted">
        Everything a family can ask of an organisation, in one place. Say no when you need to: a
        declined family is told straight away, and nothing is left hanging.
      </p>

      <nav
        aria-label="Kind of request"
        className="mb-[18px] inline-flex max-w-full flex-wrap rounded-full border-(length:--border-width) border-line bg-sunken p-1"
      >
        {TABS.map((t) => {
          const on = t.key === current.key
          const n = pending(t.key)
          return (
            <Link
              key={t.key}
              aria-current={on ? 'page' : undefined}
              href={`?tab=${t.key}`}
              scroll={false}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold ${
                on ? 'bg-surface text-ink shadow-e1' : 'text-muted hover:text-ink'
              }`}
            >
              <t.icon weight="bold" aria-hidden="true" />
              {t.label}
              {n > 0 && (
                <span className="rounded-full bg-apricot px-2 py-px text-xs text-[#1c2530]">
                  {n}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <p className="mb-3 text-sm text-muted">{current.lead}</p>

      {rows.length === 0 ? (
        <div className="browse-empty p-9 text-muted">{current.empty}</div>
      ) : (
        <ul className="grid list-none gap-2.5">
          {rows.map((t) => {
            // A build and a print both live under /build/ or /print-requests/
            // on the leader's side; a toy handoff is an ordinary exchange
            // thread. Answering happens there: accepting a toy needs a pickup
            // address, a print a bed check, a decline a reason — a button here
            // that skipped them would be the fast path to a wrong answer.
            const href =
              t.type === 'build'
                ? (`/dashboard/exchanges/build/${t.id}` as const)
                : t.type === 'print'
                  ? (`/dashboard/print-requests/${t.id}` as const)
                  : (`/dashboard/exchanges/${t.id}` as const)
            const note = t.last_message?.kind === 'user' ? t.last_message.body : null
            return (
              <li
                key={t.id}
                className="card-flat grid grid-cols-1 items-center gap-4 px-5 py-4 shadow-e1 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-ink">
                    {t.requester_name ?? 'A family'}{' '}
                    <span className="font-semibold text-muted">
                      · {formatRelativeTime(t.created_at)}
                    </span>
                  </p>
                  <p className="mt-[3px] truncate text-sm text-muted">
                    <BookOpenText
                      weight="bold"
                      className="mr-1 inline text-brand-dark"
                      aria-hidden="true"
                    />
                    {subjectName(t)}
                    {note && ` · “${note}”`}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {t.status === 'requested' ? (
                    <Link href={href} className="btn btn-primary min-h-11 px-4 text-sm">
                      Open the request
                    </Link>
                  ) : (
                    <>
                      <Badge status={t.status} />
                      <Link href={href} className="btn btn-quiet min-h-11 px-3.5 text-sm">
                        Open the thread
                      </Link>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
