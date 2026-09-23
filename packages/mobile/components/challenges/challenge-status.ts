// packages/mobile/components/challenges/challenge-status.ts
// What the board derives from a challenge's own fields: its pill, its counts,
// the stat tiles and the History timeline. Pure, so the list and the detail
// screen say the same thing about the same row.
import type { PublicChallenge, ToyIdeaDetail } from '@splat-connect/types'

type PillSource = Pick<PublicChallenge, 'status' | 'kind' | 'answered_at'> & { answer_message_id?: string | null }

/** The row's status pill: a Badge status key (for its tone) and its words. */
export function challengePill(c: PillSource): { status: string; label: string } {
  if (c.status === 'graduated') return { status: 'graduated', label: 'Became a guide' }
  if (c.kind === 'question') {
    // The detail brief carries the marked message; the list carries the date.
    return c.answered_at || c.answer_message_id ?{ status: 'accepted', label: 'Answered' } : { status: 'pending', label: 'Waiting' }
  }
  return { status: 'approved', label: 'Live' }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "3 makers · 4 posts" — a question counts its answers instead (078). */
export function challengeCounts(c: Pick<PublicChallenge, 'kind' | 'maker_count' | 'answer_count'>): string {
  if (c.kind === 'question') return plural(c.answer_count, 'answer')
  return `${plural(c.maker_count, 'maker')} · ${plural(c.answer_count, 'post')}`
}

const DAY = 86_400_000

/**
 * The stat tiles. Saves are left out: the API keeps no public save count, and a
 * tile that always says 0 would be a claim. "Days open" only while it is open.
 */
export function challengeStats(c: ToyIdeaDetail, now: Date): { n: number; label: string }[] {
  const question = c.kind === 'question'
  const tile = (n: number, one: string, many: string) => ({ n, label: n === 1 ? one : many })
  const stats = [
    tile(c.maker_count ?? c.participants.length, 'maker', 'makers'),
    question ? tile(c.answer_count ?? 0, 'answer', 'answers') : tile(c.answer_count ?? 0, 'post', 'posts'),
  ]
  if (c.status === 'challenge' && !(question && c.answered_at)) {
    const days = Math.max(0, Math.floor((now.getTime() - new Date(c.created_at).getTime()) / DAY))
    stats.push(tile(days, 'day open', 'days open'))
  }
  return stats
}

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

/**
 * The History timeline, oldest first. "Opened" has no date of its own — the
 * schema records when an idea was submitted, not when an admin opened it — so
 * it is a step without one rather than a guessed date.
 */
export function challengeHistory(c: ToyIdeaDetail): { title: string; date: string | null }[] {
  const question = c.kind === 'question'
  const events: { title: string; date: string | null }[] = [
    { title: question ? 'Question asked' : 'Idea submitted', date: longDate(c.created_at) },
  ]
  if (!question && (c.status === 'challenge' || c.status === 'graduated')) {
    events.push({ title: 'Opened as a challenge', date: null })
  }
  if (c.participants.length > 0) {
    const first = [...c.participants].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0]
    const n = c.participants.length
    const who = question ? (n === 1 ? '1 person' : `${n} people`) : plural(n, 'maker')
    events.push({ title: `${who} joined`, date: `Since ${shortDate(first.joined_at)}` })
  }
  if (question && c.answered_at) events.push({ title: 'Answered', date: longDate(c.answered_at) })
  if (c.status === 'graduated') events.push({ title: 'Became a guide', date: null })
  return events
}
