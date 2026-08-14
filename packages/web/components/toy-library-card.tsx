import Link from 'next/link'
import { CardPhoto } from './card-photo'
import type { ToyWithOwner } from '@splat-connect/types'

export function ToyLibraryCard({ toy }: { toy: ToyWithOwner }) {
  return (
    <Link
      href={`/toy-library/${toy.id}`}
      data-testid="toy-library-card"
      className="card card-link overflow-hidden"
    >
      <CardPhoto src={toy.cover_photo_url} />
      <div className="p-4">
        <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
        <p className="mt-1 text-xs text-muted">Condition {toy.condition} / 10</p>
        {toy.profiles?.name && (
          <p className="mt-1 text-xs text-muted">Held by {toy.profiles.name}</p>
        )}
        {toy.switch_adapted && (
          <span className="badge mt-3 inline-block bg-mint-soft text-mint-deep">
            Switch-adapted
          </span>
        )}
      </div>
    </Link>
  )
}
