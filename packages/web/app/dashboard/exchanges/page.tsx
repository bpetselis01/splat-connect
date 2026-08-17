import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { needsAction, actionLabel } from '@splat-connect/types'
import type { ToyTransactionSummary } from '@splat-connect/types'

export default async function ExchangesPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  const viewerId = caps.profile.id
  const transactions = await apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Exchanges</h1>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted">No donation or exchange requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link href={`/dashboard/exchanges/${tx.id}`} className="card card-link flex flex-col gap-1 p-4">
                <p className="font-bold text-ink">{tx.toy_name}</p>
                <p className="text-sm text-muted">
                  {tx.type === 'donation' ? 'Donation' : 'Exchange'} with {tx.other_party_name} — {tx.status}
                </p>
                {needsAction(tx, viewerId) && (
                  <p className="text-sm font-semibold text-mint-deep">{actionLabel(tx)}</p>
                )}
                {tx.blocked_by_rival_accept && (
                  <p className="text-sm text-muted">Locked — another request accepted</p>
                )}
                {tx.last_message && (
                  <p className="truncate text-sm text-muted">
                    {tx.last_message.sender_id === viewerId && tx.last_message.kind === 'user' && 'You: '}
                    {tx.last_message.body}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
