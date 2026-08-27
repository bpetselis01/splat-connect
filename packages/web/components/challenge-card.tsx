import Link from 'next/link'
import { SaveButton, type SaveProps } from './save-button'
import type { Route } from 'next'
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
}: {
  idea: Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'>
  save?: SaveProps
}) {
  const card = (
    <Link
      href={`/get-involved/design-challenges/${idea.id}` as Route<string>}
      className="card card-link p-5"
      data-testid="challenge-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-black text-ink">{idea.title}</h3>
        {idea.status === 'graduated' ? (
          <span className="badge bg-mint-soft text-mint-deep">Being written up</span>
        ) : (
          <span className="chip">Looking for makers</span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{idea.summary}</p>
    </Link>
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
