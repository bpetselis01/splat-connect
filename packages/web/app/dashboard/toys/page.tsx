import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { CardPhoto } from '@/components/card-photo'
import { Badge } from '@/components/badge'
import { Box } from '@/components/icons'
import { BoundaryLink } from '@/components/boundary-link'
import type { Toy } from '@splat-connect/types'

export default async function ToyListPage() {
  const caps = await requireCapabilities()

  // No .catch() here: an empty array is already the legitimate "no toys yet"
  // value, so swallowing a fetch failure into the same empty array would tell
  // an owner their toys are gone. Let a failed fetch throw into error.tsx.
  const toys = await apiClient.get<Toy[]>('/api/toys')

  const activeToys = toys.filter((t) => !t.archived_at)
  const archivedToys = toys.filter((t) => t.archived_at)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="title-hub">My toys</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            The adapted toys you hold, ready to offer for exchange with an association.
          </p>
        </div>
        {/* The My SPLAT card promises three things here. Two of them exist;
            "Saved toys" waits on the saves subsystem, and an absent button
            beats one that leads nowhere. */}
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/toys/new" className="btn btn-accent">
            + Add a toy
          </Link>
          <BoundaryLink href="/toy-library" className="btn btn-quiet">
            Browse toy library
          </BoundaryLink>
          {/* The tag on this page's My SPLAT card names "saved toys";
              this is where that tag leads. It skips the saved hub on purpose —
              the label names a destination, so it lands on the destination. */}
          <Link href="/dashboard/saved/toys" className="btn btn-quiet">
            Saved toys
          </Link>
        </div>
      </div>

      {activeToys.length === 0 ? (
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
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {activeToys.map((toy) => (
            <li key={toy.id}>
              <Link
                href={`/dashboard/toys/${toy.id}`}
                className="card card-link flex h-full flex-col overflow-hidden"
              >
                <CardPhoto src={toy.cover_photo_url} />
                {/* Same block as dashboard-tutorial-card.tsx: title, then a
                    status pill beside one line of detail. */}
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={toy.status} />
                    <p className="text-xs leading-relaxed text-muted">
                      Condition {toy.condition} / 10
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archivedToys.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-muted">Archived</h2>
          <ul className="grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
            {archivedToys.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/toys/${t.id}`}
                  className="card card-link flex h-full flex-col overflow-hidden"
                >
                  <CardPhoto src={t.cover_photo_url} />
                  {/* Same block as dashboard-tutorial-card.tsx: title, then a
                      status pill beside one line of detail. */}
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="truncate text-sm font-bold text-ink">{t.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge status={t.status} />
                      <p className="text-xs leading-relaxed text-muted">
                        Condition {t.condition} / 10
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
