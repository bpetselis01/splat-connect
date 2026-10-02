/**
 * The guides library's rail and sort menu, as pure functions over the list the
 * API returned — spec docs/superpowers/specs/2026-09-18-library-backend-design.md.
 *
 * One choice per facet, as the board draws it: tapping the chosen option
 * clears it. Time buckets read hands-on time only (build_minutes excludes
 * printing), so "Under 1 hour" includes everything "Under 30 min" does, and
 * "Needs printing" is the one bucket that reads has_stl instead.
 */
import type { Difficulty, Tutorial, TutorialKind } from '@splat-connect/types'

type TimeBucket = 'u30' | 'u60' | 'print'
export type Filters = { type?: TutorialKind; skill?: Difficulty; time?: TimeBucket }
export type SortKey = 'new' | 'diff' | 'time'
export type SortDir = 'asc' | 'desc'

type Listed = Pick<Tutorial, 'difficulty' | 'kind' | 'title' | 'created_at' | 'reviewed_at'> & {
  build_minutes?: number | null
  has_stl?: boolean
}

export const SORTS: { key: SortKey; label: string; hint: string; dir: SortDir; labels: [asc: string, desc: string] }[] = [
  { key: 'new', label: 'Date added', hint: 'Newest ↔ oldest', dir: 'desc', labels: ['Oldest first', 'Newest first'] },
  { key: 'diff', label: 'Difficulty', hint: 'Easiest ↔ hardest', dir: 'asc', labels: ['Easiest first', 'Hardest first'] },
  { key: 'time', label: 'Build time', hint: 'Quickest ↔ longest', dir: 'asc', labels: ['Quickest first', 'Longest first'] },
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
      (!f.type || t.kind === f.type) &&
      (!f.skill || t.difficulty === f.skill) &&
      (!f.time || inTime(t, f.time)) &&
      (!q || t.title.toLowerCase().includes(q))
  )
}

/** "Date added" is when it went public, not when its draft began. */
const added = (t: Listed) => Date.parse(t.reviewed_at ?? t.created_at)

export function sortGuides<T extends Listed>(list: T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (key === 'time') {
      // An untimed guide goes last whichever way the list runs — it has no
      // place in "quickest" or "longest", and draft-only nulls are rare.
      if (a.build_minutes == null) return b.build_minutes == null ? 0 : 1
      if (b.build_minutes == null) return -1
      return (a.build_minutes - b.build_minutes) * sign
    }
    const va = key === 'diff' ? RANK[a.difficulty] : added(a)
    const vb = key === 'diff' ? RANK[b.difficulty] : added(b)
    return (va - vb) * sign
  })
}
