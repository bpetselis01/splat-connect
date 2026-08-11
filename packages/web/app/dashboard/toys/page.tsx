import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
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
      <h1 className="mb-2 text-2xl font-bold text-ink">My toys</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        The adapted toys you hold, ready to offer for exchange with an association.
      </p>

      <ul className="mb-6 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {toys.map((toy) => (
          <li key={toy.id}>
            <Link href={`/dashboard/toys/${toy.id}`} className="card card-link overflow-hidden">
              {toy.cover_photo_url ? (
                <div className="relative h-36 w-full bg-sunken">
                  <Image src={toy.cover_photo_url} alt={toy.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center bg-brand-tint text-4xl">
                  🧸
                </div>
              )}
              <div className="p-4">
                <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
                <p className="mt-1 text-xs text-muted">Condition {toy.condition} / 10</p>
                {toy.status === 'draft' && <span className="badge mt-2">Draft</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/toys/new" className="btn btn-primary btn-sm">
        Add a toy
      </Link>
    </div>
  )
}
