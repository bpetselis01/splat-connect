import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import type { ToyTransactionSummary } from '@splat-connect/types'

export default async function ExchangesPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
