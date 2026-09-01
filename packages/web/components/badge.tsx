/**
 * Every status pill on the site.
 *
 * This replaces six near-identical components (status-badge, toy-status-badge,
 * exchange-status-badge, idea-status-badge, difficulty-badge, kind-badge) that
 * each rendered the same `<span className="badge …">` from their own copy of
 * the same five palette pairs. They were kept apart so a toy could never be
 * handed a tutorial's status; the map below is keyed by the status *word*
 * instead, and no word ever meant two different colours across the six, so the
 * split was buying type narrowing at the cost of the drift it was meant to
 * prevent.
 *
 * The colours are borrowed on meaning, not on spelling:
 * - sunken     nothing has happened yet, or it stopped happening
 * - honey      waiting on somebody
 * - brand tint arranged, but not done
 * - mint       this is live / finished
 * - apricot    it did not go ahead
 *
 * Not `lib/tone.ts`: that map's `sunken` inks with `text-ink`, badges have
 * always used `text-brand-deep`, and this is a pure refactor.
 *
 * Text defaults to the status word in caps. Pass `label` where the word is not
 * the copy — the kinds, and the idea lifecycle, whose wording matches
 * components/challenge-card.tsx exactly and must never claim more than the
 * public card does ('graduated' means a maker has taken the idea on and a draft
 * guide is being written, never that a guide is published).
 */
import type { ToyIdeaStatus } from '@splat-connect/types'

const SUNKEN = 'bg-sunken text-brand-deep'
const HONEY = 'bg-honey-soft text-honey-deep'
const MINT = 'bg-mint-soft text-mint-deep'
const APRICOT = 'bg-apricot-soft text-apricot-deep'
const BRAND = 'bg-brand-tint text-brand-deep'

export const STATUS_TONE = {
  // tutorial review
  draft: SUNKEN,
  pending: HONEY,
  approved: MINT,
  rejected: APRICOT,
  // toy
  published: MINT,
  // exchange
  requested: HONEY,
  accepted: BRAND,
  completed: MINT,
  withdrawn: SUNKEN,
  // idea → challenge
  challenge: BRAND,
  graduated: MINT,
  // difficulty
  easy: MINT,
  medium: HONEY,
  hard: APRICOT,
  // tutorial kind — no lifecycle, so it takes the neutral pair
  toy_adaptation: SUNKEN,
  assistive_tech: SUNKEN,
  // maturity — 'complete' never renders a badge, absence is the signal
  concept: SUNKEN,
  prototype: HONEY,
  in_progress: BRAND,
}

export type BadgeStatus = keyof typeof STATUS_TONE

/** The author-facing wording for an idea's lifecycle. */
export const IDEA_LABEL: Record<ToyIdeaStatus, string> = {
  pending: 'Pending review',
  challenge: 'Looking for makers',
  graduated: 'Being written up',
  rejected: 'Not taken forward',
}

/**
 * Both fallbacks are for a status that is absent rather than unknown — a
 * half-built tutorial in a test fixture, say. KindBadge tolerated that (its
 * colour was hardcoded and a missing label rendered nothing) where the other
 * five threw, so the neutral pair and the empty label keep the gentler of the
 * two behaviours. Every status word that actually exists is in the map, so
 * neither fallback fires on real data.
 */
export function Badge({ status, label }: { status: BadgeStatus; label?: string }) {
  return (
    <span className={`badge ${STATUS_TONE[status] ?? SUNKEN}`}>{label ?? status?.toUpperCase()}</span>
  )
}
