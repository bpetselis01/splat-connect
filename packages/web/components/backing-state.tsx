/**
 * Backing State — the single owner of how backing is worded and coloured.
 *
 * Every surface renders through this. The status→colour map used to live in two
 * pages and drifted apart, which is why Badge exists; this exists for the
 * same reason, before the drift rather than after it.
 *
 * The three states reuse Badge's palette deliberately: honey already means
 * "waiting" on this platform, mint means "went through", apricot means "did not".
 * A contributor should not have to learn a second colour language, and a leader
 * looking at both badges on one row should see them agree.
 *
 * Two shapes, because two jobs:
 * - BackingSummary: one line of prose, for list rows where there is no column for
 *   a badge and the reader wants the answer, not a label.
 * - BackingBadge: the state word alone, for the edit page's list where the
 *   organisation's name is already the row.
 *
 * Copy is fixed by §1 of the spec. "Reviewed by SPLAT" is deliberately not "no
 * organisation" — it is a complete, normal path, the one every contributor took
 * before organisations existed, and naming it as an absence makes the default case
 * read as a failure.
 *
 * Related files:
 * - components/badge.tsx: the palette and badge shape this follows
 * - docs/superpowers/specs/2026-07-28-contributor-backing-experience-design.md §1
 */
import type { TutorialOrg } from '@splat-connect/types'

const BADGE: Record<TutorialOrg['status'], string> = {
  pending: 'bg-honey-soft text-honey-deep',
  accepted: 'bg-mint-soft text-mint-deep',
  declined: 'bg-apricot-soft text-apricot-deep',
}

const WORD: Record<TutorialOrg['status'], string> = {
  pending: 'DECIDING',
  accepted: 'BACKING',
  declined: 'DECLINED',
}

const nameOf = (r: TutorialOrg) => r.organizations?.name ?? 'An organisation'

/** "Riverside and Northside", "Riverside, Northside and Eastside" */
function join(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function BackingSummary({ backing }: { backing: TutorialOrg[] }) {
  const accepted = backing.filter((b) => b.status === 'accepted')
  const pending = backing.filter((b) => b.status === 'pending')
  const declined = backing.filter((b) => b.status === 'declined')

  let text: string
  let tone: string

  if (accepted.length) {
    text = `Backed by ${join(accepted.map(nameOf))}`
    if (pending.length) text += ` · ${pending.length} still deciding`
    tone = 'text-mint-deep'
  } else if (pending.length === 1) {
    text = `${nameOf(pending[0])} is deciding`
    tone = 'text-honey-deep'
  } else if (pending.length > 1) {
    text = `${pending.length} organisations deciding`
    tone = 'text-honey-deep'
  } else if (declined.length) {
    const who =
      declined.length === 1
        ? `${nameOf(declined[0])} declined`
        : `${declined.length} organisations declined`
    // Say where it went. A decline is not a dead end — the tutorial is still
    // queued, with the platform instead — and a contributor reading only the
    // refusal would reasonably assume their work had stalled.
    text = `${who} · now reviewed by SPLAT`
    tone = 'text-apricot-deep'
  } else {
    text = 'Reviewed by SPLAT'
    tone = 'text-muted'
  }

  return <p className={`mt-0.5 text-xs leading-relaxed ${tone}`}>{text}</p>
}

export function BackingBadge({ status }: { status: TutorialOrg['status'] }) {
  return <span className={`badge ${BADGE[status]}`}>{WORD[status]}</span>
}
