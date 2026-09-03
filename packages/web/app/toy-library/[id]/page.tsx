import { notFound } from 'next/navigation'
import { ToySummary } from '@/components/toy-summary'
import { PhotoCarousel } from '@/components/photo-carousel'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { SaveButton } from '@/components/save-button'
import { getSavedIds } from '@/lib/saves'
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
  const rawMyToys = caps ? await apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]) : []
  const myToys = rawMyToys.filter((t) => t.status === 'published')

  const saved = await getSavedIds()

  return (
    <div className="panel pt-5">
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          {toy.profiles?.name && (
            <p className="text-sm font-semibold text-muted">Held by {toy.profiles.name}</p>
          )}
        {/* Not an island here: there is no card to sit on, and you often
            arrive at this page from a shared link with no card in sight. An
            ordinary control in the header row, sized up from the 34px square
            the browse grid uses. */}
          <SaveButton
            slug="toys"
            id={toy.id}
            saved={saved?.toys.includes(toy.id) ?? false}
            signedIn={saved !== null}
            className="ml-auto !h-9 !w-auto gap-2 px-3"
          />
        </div>
        <ToySummary
          toy={toy}
          photos={
            <PhotoCarousel
              urls={toy.photo_urls}
              switchUrl={toy.switch_adapted ? toy.switch_photo_url : null}
              alt={toy.name}
            />
          }
        />
        <ToyTransactionRequest toy={toy} viewerId={caps?.profile.id ?? null} myToys={myToys} />
      </div>
    </div>
  )
}
