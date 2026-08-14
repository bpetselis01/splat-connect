import { notFound } from 'next/navigation'
import { ToySummary } from '@/components/toy-summary'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

export default async function ToyLibraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/toys/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const toy = (await res.json()) as ToyWithOwner

  const caps = await getCapabilities()
  const myToys = caps ? await apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]) : []

  return (
    <div className="panel pt-5">
      <div className="flex flex-col gap-4 px-5 pb-5">
        {toy.profiles?.name && (
          <p className="text-sm font-semibold text-muted">Held by {toy.profiles.name}</p>
        )}
        <ToySummary toy={toy} />
        <ToyTransactionRequest toy={toy} viewerId={caps?.profile.id ?? null} myToys={myToys} />
      </div>
    </div>
  )
}
