import Link from 'next/link'
import { CardPhoto } from './card-photo'
import { toyHolderName } from '@splat-connect/types'
import type { ToyWithOwner } from '@splat-connect/types'

export function ToyLibraryCard({ toy }: { toy: ToyWithOwner }) {
  const holder = toyHolderName(toy)
  return (
    <Link
      href={`/toy-library/${toy.id}`}
      data-testid="toy-library-card"
      className="card-playroom card-link overflow-hidden"
    >
      <CardPhoto src={toy.cover_photo_url} />
      <div className="p-4">
        <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
        <p className="mt-1 text-xs text-muted">Condition {toy.condition} / 10</p>
        {holder && <p className="mt-1 text-xs text-muted">Held by {holder}</p>}
        {/* Only ever shown for an organisation: a person's toy is always one
            object, so "1 available" would be noise on every other card. */}
        {toy.owner_org_id && (
          <p className="mt-1 text-xs text-muted">{toy.quantity} available</p>
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
