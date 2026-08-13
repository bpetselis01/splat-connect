import Link from 'next/link'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { CardPhoto } from '@/components/card-photo'
import { Box } from '@/components/icons'
import type { Toy } from '@splat-connect/types'

export default async function ToyListPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // No .catch() here: an empty array is already the legitimate "no toys yet"
  // value, so swallowing a fetch failure into the same empty array would tell
  // an owner their toys are gone. Let a failed fetch throw into error.tsx.
  const toys = await apiClient.get<Toy[]>('/api/toys')

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">My toys</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            The adapted toys you hold, ready to offer for exchange with an association.
          </p>
        </div>
        <Link href="/dashboard/toys/new" className="btn btn-accent">
          + Add a toy
        </Link>
      </div>

      {toys.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Box className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">You haven&apos;t added any toys yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            A toy is one adapted item you hold — its condition, a photo, and whether it has been
            wired for a switch.
          </p>
          <Link href="/dashboard/toys/new" className="btn btn-accent mt-6">
            Add your first toy
          </Link>
        </div>
      ) : (
        <ul className="grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {toys.map((toy) => (
            <li key={toy.id}>
              <Link
                href={`/dashboard/toys/${toy.id}`}
                className="card card-link flex h-full flex-col overflow-hidden"
              >
                <CardPhoto src={toy.cover_photo_url} alt={toy.name} />
                <div className="p-4">
                  <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
                  <p className="mt-1 text-xs text-muted">Condition {toy.condition} / 10</p>
                  {toy.status === 'draft' && <span className="badge mt-2">Draft</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
