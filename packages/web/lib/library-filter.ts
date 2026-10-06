/**
 * The guides library's rail and sort, as pure functions over the list the
 * API returned — specs 2026-09-18-library-backend-design and 2026-10-05-guide-tags-design.
 *
 * Skill and time are one choice each, as the board draws it: tapping the
 * chosen option clears it. The tag groups take several. Time buckets read hands-on time only (build_minutes excludes
 * printing), so "Under 1 hour" includes everything "Under 30 min" does, and
 * "Needs printing" is the one bucket that reads has_stl instead.
 */
import {
  NO_SUITS_FILTER,
  byRecommended,
  matchesSuits,
  type ChildTags,
  type Difficulty,
  type Suits,
  type SuitsFilter,
  type Tutorial,
} from '@splat-connect/types'

type TimeBucket = 'u30' | 'u60' | 'print'
/** `suits` is the tag questions (guide-tags spec): any choice within a group, all groups together. */
export type Filters = { skill?: Difficulty; time?: TimeBucket; suits?: SuitsFilter }
export type SortKey = 'recommended' | 'new' | 'quick' | 'easy'

type Listed = Pick<Tutorial, 'difficulty' | 'title' | 'created_at' | 'reviewed_at'> &
  Suits & {
    build_minutes?: number | null
    has_stl?: boolean
  }

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'new', label: 'Newest' },
  { key: 'quick', label: 'Quickest' },
  { key: 'easy', label: 'Easiest' },
]

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

function inTime(t: Listed, bucket: TimeBucket): boolean {
  if (bucket === 'print') return !!t.has_stl
  if (t.build_minutes == null) return false
  return t.build_minutes <= (bucket === 'u30' ? 30 : 60)
}

export function filterGuides<T extends Listed>(list: T[], f: Filters, search = ''): T[] {
  const q = search.trim().toLowerCase()
  return list.filter(
    (t) =>
      (!f.skill || t.difficulty === f.skill) &&
      (!f.time || inTime(t, f.time)) &&
      matchesSuits(t, f.suits ?? NO_SUITS_FILTER) &&
      (!q || t.title.toLowerCase().includes(q))
  )
}

/** "Newest" is when it went public, not when its draft began. */
const added = (t: Listed) => Date.parse(t.reviewed_at ?? t.created_at)

/** Recommended is byRecommended's order for `child` (newest first without one). */
export function sortGuides<T extends Listed>(list: T[], key: SortKey, child: ChildTags | null = null): T[] {
  if (key === 'recommended') return byRecommended(list, child)
  // An untimed guide has no place in "quickest", so it goes last.
  const by =
    key === 'quick'
      ? (t: T) => t.build_minutes ?? Number.MAX_SAFE_INTEGER
      : key === 'easy'
        ? (t: T) => RANK[t.difficulty] * 10_000 + (t.build_minutes ?? 9_999)
        : (t: T) => -added(t)
  return [...list].sort((a, b) => by(a) - by(b))
}
