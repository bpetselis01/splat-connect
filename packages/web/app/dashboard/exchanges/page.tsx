import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { ExchangeStatusBadge } from '@/components/exchange-status-badge'
import { Handshake } from '@/components/icons'
import { needsAction, actionLabel } from '@splat-connect/types'
import type { ToyTransactionSummary } from '@splat-connect/types'

export default async function ExchangesPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  const viewerId = caps.profile.id
  // Without these, an org request waiting on a leader is never marked "waiting
  // on you" — the row is visible but reads as somebody else's problem.
  const ledOrgIds = caps.ledOrgs.map((org) => org.id)
  const transactions = await apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Exchanges</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Toys you have asked for and toys people have asked you for. Each one is a conversation
          until the handoff is confirmed by both sides.
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Handshake className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">No donation or exchange requests yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Ask for a toy from the library, or list one of yours, and the conversation starts here.
          </p>
          <Link href="/toy-library" className="btn btn-accent mt-6">
            Browse the toy library
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link
                href={`/dashboard/exchanges/${tx.id}`}
                className="card card-link flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{tx.toy_name}</p>
                    <p className="truncate text-sm text-muted">
                      {tx.type === 'donation' ? 'Donation' : 'Exchange'} with {tx.other_party_name}
                    </p>
                    {/* A leader's personal handoffs and their organisation's
                        arrive in one list, and nothing else tells them apart —
                        which of the two they are answering as changes who the
                        toy belongs to. */}
                    {tx.acting_for_org_name && (
                      <p className="mt-1 truncate text-xs text-muted">
                        On behalf of {tx.acting_for_org_name}
                      </p>
                    )}
                  </div>
                  <ExchangeStatusBadge status={tx.status} />
                </div>

                {/* The one line on this card that is an instruction rather than
                    a fact, so it is the one line that is not muted grey. */}
                {needsAction(tx, viewerId, ledOrgIds) && (
                  <p className="self-start rounded-field bg-mint-soft px-2.5 py-1 text-sm font-bold text-mint-deep">
                    {actionLabel(tx)}
                  </p>
                )}

                {tx.blocked_by_rival_accept && (
                  <p className="text-sm text-muted">Locked — another request accepted</p>
                )}

                {tx.last_message && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                    <p className="truncate text-sm text-muted">
                      {tx.last_message.sender_id === viewerId &&
                        tx.last_message.kind === 'user' &&
                        'You: '}
                      {tx.last_message.body}
                    </p>
                    <time
                      dateTime={tx.last_message.created_at}
                      className="shrink-0 text-xs text-muted"
                    >
                      {new Date(tx.last_message.created_at).toLocaleDateString('en-AU')}
                    </time>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
