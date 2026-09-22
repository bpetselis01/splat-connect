import { PuzzlePiece } from '@phosphor-icons/react/dist/ssr'
import { SaveButton, type SaveProps } from './save-button'
import { BoundaryLink } from './boundary-link'
import type { ToyIdea } from '@splat-connect/types'

/**
 * GET /api/public/challenges (packages/api/src/routes/public.ts) selects an
 * explicit column list — id, title, summary, contact_prefs, status,
 * created_at — and never joins toy_idea_participants, so there is no
 * participant count to show here. `status` stands in: 'challenge' is still
 * open (draws the "Looking for makers" chip). 'graduated' means an admin
 * ran POST /admin/ideas/:id/graduate, which creates a tutorial with
 * status: 'draft' (admin.ts:367) — not a published guide. Moving that draft
 * to 'pending' review and then approving it are two further, separate steps
 * (tutorials.ts:143-151), so "graduated" only ever means a maker has taken
 * it on and a write-up is under way. The badge says exactly that, not more.
 *
 * Links to the `[id]` detail page (Task 14), which renders the full brief
 * and the join/thread flow this card only teases.
 */
export function ChallengeCard({
  idea,
  save,
  tint,
}: {
  idea: Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'>
  save?: SaveProps
  /**
   * Opt-in: the board's listing card — a 4:3 tinted art band over the text.
   * The saved-items page keeps the compact row by not passing it.
   */
  tint?: string
}) {
  const graduated = idea.status === 'graduated'
  const card = tint ? (
    <BoundaryLink
      href={`/get-involved/design-challenges/${idea.id}`}
      className="card card-link flex h-full flex-col overflow-hidden p-0"
      data-testid="challenge-card"
    >
      <span
        aria-hidden="true"
        className="grid aspect-[4/3] place-items-center"
        style={{ background: graduated ? 'var(--tok)' : tint }}
      >
        <PuzzlePiece weight="duotone" className="text-[76px] text-[var(--tink)] opacity-70" />
      </span>
      <span className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-[18px]">
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--tok)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--tink)]">
            {graduated ? 'Being written up' : 'Open'}
          </span>
        </span>
        <h3 className="font-display text-lg font-extrabold leading-[1.2] text-ink">{idea.title}</h3>
        <span className="line-clamp-3 flex-1 text-sm leading-[1.5] text-muted">{idea.summary}</span>
      </span>
    </BoundaryLink>
  ) : (
    // Same crossing as the other two saved cards — see tutorial-card.tsx. The
    // Route cast goes with next/link; BoundaryLink takes a plain string.
    <BoundaryLink
      href={`/get-involved/design-challenges/${idea.id}`}
      className="card card-link p-5"
      data-testid="challenge-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="card-title">{idea.title}</h3>
        {idea.status === 'graduated' ? (
          <span className="badge bg-mint-soft text-ink">Being written up</span>
        ) : (
          <span className="chip">Looking for makers</span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{idea.summary}</p>
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
