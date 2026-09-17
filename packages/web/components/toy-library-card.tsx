import { BoundaryLink } from './boundary-link'
import { SaveButton, type SaveProps } from './save-button'
import { Gift, HandTap, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { CardPhoto } from './card-photo'
import { toyHolderName } from '@splat-connect/types'
import type { ToyWithOwner } from '@splat-connect/types'

/**
 * Condition, as the word a parent actually wants.
 *
 * The board's toy rows carry a grade pill, not a fraction: "Condition 5 / 10"
 * is a number you have to interpret, and on a grid of twelve nobody does. The
 * buckets are the toy library's own filter buckets, so the pill and the filter
 * that found it say the same word.
 */
function grade(condition: number): { label: string; tint: string } {
  if (condition >= 7) return { label: 'Good', tint: 'var(--tok)' }
  if (condition >= 4) return { label: 'Fair', tint: 'var(--tamber)' }
  return { label: 'Well-loved', tint: 'var(--surface2)' }
}

export function ToyLibraryCard({ toy, save }: { toy: ToyWithOwner; save?: SaveProps }) {
  const holder = toyHolderName(toy)
  const { label: gradeLabel, tint: gradeTint } = grade(toy.condition)
  const card = (
    // Same crossing as tutorial-card.tsx: this renders on /dashboard/saved/toys
    // too, where /toy-library/[id] leaves the rail behind.
    <BoundaryLink
      href={`/toy-library/${toy.id}`}
      data-testid="toy-library-card"
      className="card card-link flex flex-col overflow-hidden"
    >
      <CardPhoto src={toy.cover_photo_url} icon={Gift} tint="var(--color-mint-soft)" />
      {/* The board's order: what it is, then what it is called, then who has
          it. Condition led on three separate lines of small muted text, which
          is the shape of a spec sheet rather than of a card you skim. */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-[18px] pt-4">
        <div className="flex flex-wrap gap-1.5">
          {toy.switch_adapted && (
            <span
              className="inline-flex items-center gap-1 rounded-pill px-2.5 py-[3px] text-xs font-extrabold"
              style={{ background: 'var(--b100)', color: 'var(--tink)' }}
            >
              <HandTap size={13} weight="fill" aria-hidden="true" />
              Switch-adapted
            </span>
          )}
          {/* Only ever shown for an organisation: a person's toy is always one
              object, so "1 available" would be noise on every other card. */}
          {toy.owner_org_id && (
            <span className="inline-flex items-center rounded-pill bg-sunken px-2.5 py-[3px] text-xs font-extrabold text-ink">
              {toy.quantity} available
            </span>
          )}
        </div>
        <p className="card-title-grid line-clamp-2">{toy.name}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[13px] font-bold text-muted">
          {holder ? <span className="min-w-0 truncate">Held by {holder}</span> : <span />}
          <span
            className="inline-flex flex-none items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-xs font-extrabold"
            style={{ background: gradeTint, color: 'var(--tink)' }}
            title={`Condition ${toy.condition} / 10`}
          >
            <Sparkle size={13} weight="bold" aria-hidden="true" />
            {gradeLabel}
          </span>
        </div>
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
