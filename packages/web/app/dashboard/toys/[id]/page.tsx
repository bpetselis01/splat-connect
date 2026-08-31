import { BackLink } from '@/components/back-link'
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { ToyEditor } from '@/components/toy-editor'
import { ToySummary } from '@/components/toy-summary'
import type { Toy } from '@splat-connect/types'

export default async function ToyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await requireCapabilities()

  // Reads the collection rather than one row, same reasoning as
  // EditChildPage: RLS scopes it to the caller, so a toy missing from it is
  // either gone or someone else's — 404 either way, never 403.
  const toys = await apiClient.get<Toy[]>('/api/toys')
  const toy = toys.find((t) => t.id === id)
  if (!toy) notFound()

  return (
    <div>
      <BackLink href="/dashboard/toys" label="My toys" />
      <h1 className="mb-6 title-detail">{toy.name}</h1>
      {toy.archived_at ? (
        <div className="panel p-5">
          <ToySummary toy={toy} />
        </div>
      ) : (
        <ToyEditor toy={toy} />
      )}
    </div>
  )
}
