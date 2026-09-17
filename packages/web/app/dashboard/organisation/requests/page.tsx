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
import { Tray, Gift, Hammer, Printer } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { formatRelativeTime } from '@/lib/relative-time'
import { subjectName, type ToyTransactionSummary } from '@splat-connect/types'

export const metadata = { title: 'Requests to your organisation — SPLAT Connect' }

const SHAPE = {
  donation: { icon: Gift, label: 'Wants a toy' },
  exchange: { icon: Gift, label: 'Offers a swap' },
  build: { icon: Hammer, label: 'Wants one built' },
  print: { icon: Printer, label: 'Wants parts printed' },
} as const

export default async function OrgRequestsPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const all = await apiClient
    .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
    .catch(() => [] as ToyTransactionSummary[])

  // The organisation's, not the leader's own. A leader who also gives toys
  // personally has both in that list, and only one of them is this queue.
  const ledIds = new Set(caps.ledOrgs.map((o) => o.id))
  const mine = all.filter((t) => t.owner_org_id && ledIds.has(t.owner_org_id))
  const open = mine.filter((t) => t.status === 'requested')
  const running = mine.filter((t) => t.status === 'accepted')

  return (
    <div>
      <h1 className="title-hub">Requests to your organisation</h1>
      <p className="mb-6 mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Every ask a family can make of {caps.ledOrgs[0].name}, in one queue: a toy off your
        shelf, a guide built nearby, parts printed before a build day. Open each one to accept,
        decline or hand it on.
      </p>

      {mine.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <Tray className="h-8 w-8" />
          </span>
          <p className="mt-4 font-display text-xl font-extrabold text-ink">Nothing waiting</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Requests land here when a family asks for something you have said you can do — see
            your{' '}
            <Link
              href="/dashboard/organisation/profile"
              className="font-semibold text-brand-dark hover:underline"
            >
              organisation profile
            </Link>{' '}
            for what you are currently offering.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[
            { label: 'Waiting on you', list: open },
            { label: 'Under way', list: running },
          ]
            .filter((g) => g.list.length > 0)
            .map((group) => (
              <section key={group.label}>
                <h2 className="title-detail mb-3">
                  {group.label} ({group.list.length})
                </h2>
                <ul className="flex list-none flex-col gap-3">
                  {group.list.map((t) => {
                    const shape = SHAPE[t.type]
                    // A build and a print both live under /build/ or
                    // /print-requests/ on the leader's side; a toy handoff is an
                    // ordinary exchange thread.
                    const href =
                      t.type === 'build'
                        ? (`/dashboard/exchanges/build/${t.id}` as const)
                        : t.type === 'print'
                          ? (`/dashboard/print-requests/${t.id}` as const)
                          : (`/dashboard/exchanges/${t.id}` as const)
                    return (
                      <li key={t.id}>
                        <Link href={href} className="card card-link flex items-center gap-4 p-4">
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-sunken text-brand-deep"
                          >
                            <shape.icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-ink">{subjectName(t)}</span>
                            <span className="block text-xs text-muted">
                              {shape.label} · {t.requester_name ?? 'A family'} ·{' '}
                              {formatRelativeTime(t.created_at)}
                            </span>
                            {t.last_message && (
                              <span className="mt-1 block truncate text-sm text-muted">
                                “{t.last_message.body}”
                              </span>
                            )}
                          </span>
                          <Badge status={t.status} />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
