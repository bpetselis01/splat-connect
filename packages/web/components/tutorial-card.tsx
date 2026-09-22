import { BoundaryLink } from './boundary-link'
import { SaveButton, type SaveProps } from './save-button'
import { HandTap, HandHeart, Clock, Cube, Smiley, CircleHalf, Fire, SealCheck } from '@phosphor-icons/react/dist/ssr'
import { CardPhoto, tintFor } from './card-photo'
import {
  KIND_LABEL,
  MATURITY_LABEL,
  formatBuildTime,
  type Difficulty,
  type Tutorial,
  type TutorialOrg,
} from '@splat-connect/types'

/** GET /api/public/tutorials embeds accepted backing on every row. Only the
 *  fields the card reads, so a recommendation's embedded target — a pick of
 *  the tutorial — can be a card too. */
type Listed = Pick<Tutorial, 'id' | 'title' | 'difficulty' | 'kind' | 'toy_photo_url'> & {
  description?: string | null
  maturity?: Tutorial['maturity']
  tutorial_orgs?: TutorialOrg[]
  // 066. Optional because a recommendation's embedded target does not carry
  // them; the card draws each only when it is there.
  build_minutes?: number | null
  thanks_count?: number
  has_stl?: boolean
}

/** The board's difficulty pill: its own tint and glyph per level. */
export const DIFFICULTY: Record<Difficulty, { label: string; tint: string; Icon: typeof Fire }> = {
  easy: { label: 'Easy', tint: 'var(--tok)', Icon: Smiley },
  medium: { label: 'Medium', tint: 'var(--tamber)', Icon: CircleHalf },
  hard: { label: 'Hard', tint: 'var(--tcoral)', Icon: Fire },
}

/**
 * A guide as the board draws it on /tutorials and on the home page's "Recent
 * guides" — the board's own note: "the same decorated cards as /tutorials".
 *
 * `compact` is the home page's two-up row: no blurb, a 64px glyph instead of
 * 72, a 17px title, a tighter body. Everything else is the one card.
 *
 * "Needs printing" is a chip, not a "+ print" beside the time: Byron picked it
 * from three mockups (https://claude.ai/artifact/GDpKZdLAyt4EbwJLfsgeHH). It
 * repeats the rail's own label, at the cost of a second chip row on printable
 * guides. The time beside the clock is hands-on only — the editor says so.
 */
export function TutorialCard({
  tutorial,
  save,
  compact = false,
}: {
  tutorial: Listed
  save?: SaveProps
  compact?: boolean
}) {
  const backedBy = (tutorial.tutorial_orgs ?? [])
    .filter((b) => b.status === 'accepted')
    .map((b) => b.organizations?.name ?? 'an organisation')
    .join(', ')
  const diff = DIFFICULTY[tutorial.difficulty]
  const hasTime = tutorial.build_minutes != null
  // Zero is drawn: it is a real count, and a footer that loses its heart on
  // new guides would make the grid's baselines wander.
  const hasThanks = tutorial.thanks_count != null
  const card = (
    // BoundaryLink because this card also renders on /dashboard/saved/tutorials,
    // where /tutorials/[id] is a crossing out of the account section.
    <BoundaryLink
      href={`/tutorials/${tutorial.id}`}
      data-testid="tutorial-card"
      className={`browse-card${compact ? ' browse-card--compact' : ''}`}
    >
      <CardPhoto
        src={tutorial.toy_photo_url}
        icon={tutorial.kind === 'assistive_tech' ? Cube : HandTap}
        tint={tintFor(tutorial.id)}
        iconSize={compact ? 64 : 72}
      />
      {/* Chips, then title, then blurb, then whatever is true of this one —
          the board's order: you read the difficulty to decide whether the
          title is worth reading, not the other way round. */}
      <div className="browse-card__body">
        <div className="browse-card__chips">
          <span className="pill-tag" style={{ backgroundColor: diff.tint }}>
            <diff.Icon weight="fill" aria-hidden="true" />
            {diff.label}
          </span>
          <span className="pill-tag">{KIND_LABEL[tutorial.kind]}</span>
          {tutorial.has_stl && (
            <span className="pill-tag" style={{ backgroundColor: 'var(--tviolet)' }}>
              <Cube weight="bold" aria-hidden="true" />
              Needs printing
            </span>
          )}
          {tutorial.maturity && tutorial.maturity !== 'complete' && (
            <span className="pill-tag">{MATURITY_LABEL[tutorial.maturity]}</span>
          )}
        </div>
        <p className="browse-card__title">{tutorial.title}</p>
        {!compact && tutorial.description && (
          <p className="browse-card__blurb">{tutorial.description}</p>
        )}
        {(hasTime || hasThanks || backedBy) && (
          <div className="browse-card__foot">
            <span className="browse-card__stats">
              {hasTime && (
                <span className="whitespace-nowrap">
                  <Clock aria-hidden="true" /> {formatBuildTime(tutorial.build_minutes!)}
                </span>
              )}
              {hasThanks && (
                <span title="Times people said thanks for this guide">
                  <HandHeart weight="fill" className="text-apricot" aria-hidden="true" />
                  {tutorial.thanks_count}
                  <span className="sr-only"> thanks</span>
                </span>
              )}
            </span>
            {/* Only when an organisation actually backed it: on a public card the
                absence of a badge is the correct signal. The pill says "Backed",
                as the board does; who backed it is in its accessible name. */}
            {backedBy && (
              <span
                className="pill-tag pill-tag--foot"
                style={{ backgroundColor: 'var(--tok)' }}
                title={`Backed by ${backedBy}`}
              >
                <SealCheck weight="bold" aria-hidden="true" />
                Backed
                <span className="sr-only">
                  {' '}by {backedBy}
                </span>
              </span>
            )}
          </div>
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
      <SaveButton {...save} className="absolute right-3 top-3" />
    </div>
  )
}
