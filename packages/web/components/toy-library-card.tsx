import { BoundaryLink } from './boundary-link'
import { SaveButton, type SaveProps } from './save-button'
import { CardPhoto } from './card-photo'
import { toyHolderName } from '@splat-connect/types'
import type { ToyWithOwner } from '@splat-connect/types'

export function ToyLibraryCard({ toy, save }: { toy: ToyWithOwner; save?: SaveProps }) {
  const holder = toyHolderName(toy)
  const card = (
    // Same crossing as tutorial-card.tsx: this renders on /dashboard/saved/toys
    // too, where /toy-library/[id] leaves the rail behind.
    <BoundaryLink
      href={`/toy-library/${toy.id}`}
      data-testid="toy-library-card"
      className="card card-link overflow-hidden"
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
    </BoundaryLink>
  )

  /*
   * No wrapper at all when saving is off, so every existing call site renders
   * byte-identically. That default is load-bearing rather than tidy: this card
   * also appears on pages that show your OWN work, where a save button reads as
   * a bug. Default-off keeps those correct by doing nothing, instead of by
   * remembering to switch something off.
   *
   * The island is a SIBLING of the anchor, never inside it — a <button> within
   * an <a> is invalid HTML with an ambiguous click target.
   */
  if (!save) return card

  return (
    <div className="save-host relative">
      {card}
      <SaveButton {...save} className="absolute right-2.5 top-2.5" />
    </div>
  )
}
