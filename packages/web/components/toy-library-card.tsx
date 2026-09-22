import { BoundaryLink } from './boundary-link'
import { SaveButton, type SaveProps } from './save-button'
import {
  Gift,
  HandHeart,
  ArrowsLeftRight,
  HandTap,
  CheckCircle,
  Sparkle,
  Heart,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import { CardPhoto, tintFor } from './card-photo'
import { gradeOf, type GradeKey } from '@/lib/toy-grade'
import { toyHolderName, type OfferType, type ToyWithOwner } from '@splat-connect/types'

/** The board's offer pill, in its words. */
export const OFFER: Record<OfferType, { label: string; Icon: typeof Gift }> = {
  donation: { label: 'Gift', Icon: Gift },
  both: { label: 'Swap or gift', Icon: HandHeart },
  exchange: { label: 'Swap only', Icon: ArrowsLeftRight },
}

export const GRADE_ICON: Record<GradeKey, typeof Gift> = {
  'like-new': Sparkle,
  good: CheckCircle,
  'well-loved': Heart,
  'needs-fix': Wrench,
}

/** Two letters from a holder's name, for the footer avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')
}

/**
 * A toy as the board draws it on /toys and on the home page's "Recent toys".
 *
 * `compact` is the home page's two-up row: no blurb and no "See this toy"
 * button, a 64px glyph, a 17px title. `available` draws the board's pill on
 * the photo and the full card's button; pass it only from a list that is
 * available-only by construction (the public toys endpoint hides the rest) —
 * on a saved list it would be a claim nobody checked.
 *
 * The board's second chip is a distance and its footer a thanks count; the
 * data has neither, so the second chip is whether it is already switch-adapted
 * and the thanks count is simply not drawn.
 */
export function ToyLibraryCard({
  toy,
  save,
  compact = false,
  available = false,
}: {
  toy: ToyWithOwner
  save?: SaveProps
  compact?: boolean
  available?: boolean
}) {
  const holder = toyHolderName(toy)
  const grade = gradeOf(toy.condition)
  const GradeIcon = GRADE_ICON[grade.key]
  const offer = toy.offer_type ? OFFER[toy.offer_type] : null
  const card = (
    // Same crossing as tutorial-card.tsx: this renders on /dashboard/saved/toys
    // too, where /toy-library/[id] leaves the account section.
    <BoundaryLink
      href={`/toy-library/${toy.id}`}
      data-testid="toy-library-card"
      className={`browse-card${compact ? ' browse-card--compact' : ''}`}
    >
      <CardPhoto
        src={toy.cover_photo_url}
        icon={Gift}
        tint={tintFor(toy.id)}
        iconSize={compact ? 64 : 72}
      >
        {available && (
          <span className="pill-tag browse-card__avail" style={{ backgroundColor: 'var(--tok)' }}>
            <CheckCircle weight="fill" aria-hidden="true" />
            Available
          </span>
        )}
      </CardPhoto>
      <div className="browse-card__body">
        {(offer || toy.switch_adapted || toy.owner_org_id) && (
          <div className="browse-card__chips">
            {offer && (
              <span className="pill-tag" style={{ backgroundColor: 'var(--b100)' }}>
                <offer.Icon weight="fill" aria-hidden="true" />
                {offer.label}
              </span>
            )}
            {toy.switch_adapted && (
              <span className="pill-tag">
                <HandTap aria-hidden="true" />
                Switch-adapted
              </span>
            )}
            {/* Only ever for an organisation: a person's toy is always one
                object, so "1 available" would be noise on every other card. */}
            {toy.owner_org_id && <span className="pill-tag">{toy.quantity} available</span>}
          </div>
        )}
        <p className="browse-card__title">{toy.name}</p>
        {!compact && toy.description && <p className="browse-card__blurb">{toy.description}</p>}
        <div className="browse-card__foot">
          {holder ? (
            <span className="browse-card__holder">
              <span aria-hidden="true" className="browse-card__avatar">
                {initials(holder).toUpperCase()}
              </span>
              <span className="truncate">
                <span className="sr-only">Held by </span>
                {holder}
              </span>
            </span>
          ) : (
            <span />
          )}
          <span
            className="pill-tag pill-tag--foot"
            style={{ backgroundColor: grade.tint }}
            title={`Condition ${toy.condition} / 10`}
          >
            <GradeIcon weight="bold" aria-hidden="true" />
            {grade.label}
          </span>
        </div>
        {!compact && available && <span className="browse-card__cta">See this toy</span>}
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
      <SaveButton {...save} className="absolute right-3 top-3" />
    </div>
  )
}
