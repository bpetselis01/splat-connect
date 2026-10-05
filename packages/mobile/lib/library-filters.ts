// packages/mobile/lib/library-filters.ts
//
// What the Guides and Toys filter pages offer, and how a guide or toy is
// matched against what was chosen (spec 2026-10-05-library-redesign). Pure,
// so the screens only hold state.
import {
  CHILD_MEASURES,
  ENJOYS,
  GRADES,
  HANDS,
  KIND_LABEL,
  MOVEMENTS,
  NO_SUITS_FILTER,
  gradeOf,
  matchesSuits,
  type ChildProfile,
  type Difficulty,
  type Suits,
  type SuitsFilter,
  type Tutorial,
} from '@splat-connect/types'
import type { FilterGroup, FilterValues, Measures } from '../components/library/filter-page'

const SUITS_GROUPS: FilterGroup[] = [
  { kind: 'many', key: 'movement', label: 'Movement', hint: 'the switch it takes', options: MOVEMENTS },
  { kind: 'many', key: 'hands', label: 'Hands', options: HANDS },
  { kind: 'many', key: 'play', label: 'Play', options: ENJOYS },
  { kind: 'measures', key: 'fit', label: 'Measurements', hint: 'your child’s' },
]
const SUITS_DEFAULTS: FilterValues = { movement: [], hands: [], play: [], fit: {} }
export const SUITS_KEYS = ['movement', 'hands', 'play', 'fit'] as const

export const suitsFilterOf = (v: FilterValues): SuitsFilter => ({
  movement: (v.movement as SuitsFilter['movement']) ?? [],
  hands: (v.hands as SuitsFilter['hands']) ?? [],
  play: (v.play as SuitsFilter['play']) ?? [],
  fit: (v.fit as Measures) ?? {},
})

/**
 * A child's answers as a suggestion for the suits questions: working hand,
 * what they enjoy, their measurements. Only when nothing on those questions is
 * chosen yet; the page shows it, and nothing applies until "Show".
 */
export function withChildSuggestion(v: FilterValues, child: ChildProfile | undefined): FilterValues {
  if (!child) return v
  const s = suitsFilterOf(v)
  if (s.movement.length || s.hands.length || s.play.length || Object.keys(s.fit).length) return v
  const hand = child.working_hand === 'left' ? 'left' : child.working_hand === 'right' ? 'right' : child.working_hand === 'either' ? 'both' : null
  // Only a measurement the page itself would accept: an older profile can hold
  // one out of range, which would match nothing and show "Show 0" on opening.
  const fit: Measures = {}
  for (const m of CHILD_MEASURES) {
    const n = child[m.field]
    if (typeof n === 'number' && n >= m.min && n <= m.max) fit[m.field] = n
  }
  return { ...v, hands: hand ? [hand] : [], play: [...(child.enjoys ?? [])], fit }
}

// ── Guides ──────────────────────────────────────────────────────────────────
export type GuideSort = 'new' | 'quick' | 'easy'
export const GUIDE_DEFAULTS: FilterValues = { type: 'all', suits: [], diff: [], time: 'any', parts: [], ...SUITS_DEFAULTS, sort: 'new' }

/** `suitsLabel` is "Suits Ollie"; the group is left out when no guide suits a child. */
export function guideGroups(suitsLabel: string | null): FilterGroup[] {
  return [
    { kind: 'one', key: 'type', label: 'Guide type', options: [{ value: 'all', label: 'All' }, { value: 'toy_adaptation', label: KIND_LABEL.toy_adaptation }, { value: 'assistive_tech', label: KIND_LABEL.assistive_tech }] },
    ...(suitsLabel ? [{ kind: 'many' as const, key: 'suits', label: 'For your child', options: [{ value: 'suits', label: suitsLabel }] }] : []),
    { kind: 'many', key: 'diff', label: 'Difficulty', options: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }] },
    { kind: 'one', key: 'time', label: 'Build time', options: [{ value: 'any', label: 'Any time' }, { value: '30', label: 'Under 30 min' }, { value: '60', label: 'Under 1 hour' }] },
    { kind: 'many', key: 'parts', label: 'Parts', options: [{ value: 'printable', label: 'Printable parts' }] },
    ...SUITS_GROUPS,
    { kind: 'one', key: 'sort', label: 'Sort by', options: [{ value: 'new', label: 'Newest' }, { value: 'quick', label: 'Quickest' }, { value: 'easy', label: 'Easiest' }] },
  ]
}

type ListedGuide = Pick<Tutorial, 'id' | 'kind' | 'difficulty' | 'build_minutes' | 'has_stl' | 'created_at'> & Suits

export function guideMatches(t: ListedGuide, v: FilterValues, suitsIds: Set<string>): boolean {
  const time = v.time === 'any' ? null : Number(v.time)
  return (
    (v.type === 'all' || t.kind === v.type) &&
    (!(v.suits as string[]).length || suitsIds.has(t.id)) &&
    (!(v.diff as string[]).length || (v.diff as Difficulty[]).includes(t.difficulty)) &&
    (time === null || (t.build_minutes != null && t.build_minutes <= time)) &&
    (!(v.parts as string[]).length || !!t.has_stl) &&
    matchesSuits(t, suitsFilterOf(v))
  )
}

const DIFF_RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
export function sortGuides<T extends ListedGuide>(list: T[], sort: GuideSort): T[] {
  const by =
    sort === 'quick'
      ? (t: T) => t.build_minutes ?? Number.MAX_SAFE_INTEGER
      : sort === 'easy'
        ? (t: T) => DIFF_RANK[t.difficulty] * 10_000 + (t.build_minutes ?? 9_999)
        : (t: T) => -(Date.parse(t.created_at) || 0)
  return [...list].sort((a, b) => by(a) - by(b))
}

// ── Toys ────────────────────────────────────────────────────────────────────
export type ToySort = 'new' | 'near'
export const TOY_DEFAULTS: FilterValues = { show: 'toys', avail: [], cond: [], ...SUITS_DEFAULTS, sort: 'new' }

/** Nearest first only when there is a postcode to measure from. */
export function toyGroups(hasPostcode: boolean): FilterGroup[] {
  return [
    { kind: 'one', key: 'show', label: 'Show', options: [{ value: 'toys', label: 'Toys' }, { value: 'orgs', label: 'Organisations' }] },
    { kind: 'many', key: 'avail', label: 'Availability', options: [{ value: 'available', label: 'Available now' }, { value: 'adapted', label: 'Switch-adapted' }] },
    { kind: 'many', key: 'cond', label: 'Condition', options: GRADES.map((g) => ({ value: g.key, label: g.label })) },
    ...SUITS_GROUPS,
    { kind: 'one', key: 'sort', label: 'Sort by', options: [{ value: 'new', label: 'Newest' }, ...(hasPostcode ? [{ value: 'near', label: 'Nearest first' }] : [])] },
  ]
}

type ListedToy = { condition: number; switch_adapted: boolean; quantity: number } & Suits

export function toyMatches(t: ListedToy, v: FilterValues): boolean {
  const avail = v.avail as string[]
  return (
    // A person's toy is one unit; an organisation's may run out without the row
    // going away, and that is the only "not available" a public toy has.
    (!avail.includes('available') || t.quantity > 0) &&
    (!avail.includes('adapted') || t.switch_adapted) &&
    (!(v.cond as string[]).length || (v.cond as string[]).includes(gradeOf(t.condition).key)) &&
    matchesSuits(t, suitsFilterOf(v))
  )
}

export { NO_SUITS_FILTER }
