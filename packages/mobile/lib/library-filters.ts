// packages/mobile/lib/library-filters.ts
//
// What the Guides and Toys filter pages offer, and how a guide or toy is
// matched against what was chosen (specs 2026-10-05-library-redesign and
// -guide-tags). Pure, so the screens only hold state.
import {
  ACCESS,
  CHILD_QUESTIONS,
  DEVICE_TYPES,
  GRADES,
  NO_SUITS_FILTER,
  ONE_HAND_LABEL,
  byRecommended,
  gradeOf,
  matchesSuits,
  type ChildProfile,
  type ChildTags,
  type Difficulty,
  type Suits,
  type SuitsFilter,
  type Tutorial,
} from '@splat-connect/types'
import type { FilterGroup, FilterValues } from '../components/library/filter-page'

/** The four child questions (128), as filter groups. "One hand is enough" rides in the access group as its own chip. */
const CHILD_GROUPS: FilterGroup[] = CHILD_QUESTIONS.map((q) => ({
  kind: 'many' as const,
  key: q.item,
  label: q.label,
  options: q.item === 'access' ? [...ACCESS, { value: 'one_hand', label: ONE_HAND_LABEL }] : q.options,
}))
const CHILD_DEFAULTS: FilterValues = { helps_with: [], access: [], press_force: [], play: [] }

export const suitsFilterOf = (v: FilterValues): SuitsFilter => {
  const access = (v.access as string[]) ?? []
  return {
    device_types: (v.device_types as SuitsFilter['device_types']) ?? [],
    helps_with: (v.helps_with as SuitsFilter['helps_with']) ?? [],
    access: access.filter((a) => a !== 'one_hand') as SuitsFilter['access'],
    one_hand: access.includes('one_hand'),
    press_force: (v.press_force as SuitsFilter['press_force']) ?? [],
    play: (v.play as SuitsFilter['play']) ?? [],
  }
}

/**
 * A child's answers as a suggestion for the four questions — the same answers,
 * no conversion. Only when nothing on those questions is chosen yet; the page
 * shows it, and nothing applies until "Show".
 */
export function withChildSuggestion(v: FilterValues, child: ChildProfile | undefined): FilterValues {
  if (!child) return v
  if (CHILD_GROUPS.some((g) => ((v[g.key] as string[]) ?? []).length)) return v
  return {
    ...v,
    helps_with: [...(child.helps_with ?? [])],
    access: [...(child.access ?? []), ...(child.one_hand ? ['one_hand'] : [])],
    press_force: child.press_force ? [child.press_force] : [],
    play: [...(child.enjoys ?? [])],
  }
}

// ── Guides ──────────────────────────────────────────────────────────────────
export type GuideSort = 'recommended' | 'new' | 'quick' | 'easy'
export const GUIDE_DEFAULTS: FilterValues = { sort: 'recommended', ...CHILD_DEFAULTS, device_types: [], diff: [], time: 'any', parts: [] }

/** Sort first, then the child's questions ("About Ollie"), then the guide's own. */
export function guideGroups(childName: string | null): FilterGroup[] {
  return [
    { kind: 'one', key: 'sort', label: 'Sort by', hint: childName ? `${childName}'s matches, then newest` : undefined, options: [{ value: 'recommended', label: 'Recommended' }, { value: 'new', label: 'Newest' }, { value: 'quick', label: 'Quickest' }, { value: 'easy', label: 'Easiest' }] },
    { kind: 'heading', key: 'about-child', label: `About ${childName ?? 'your child'}`, hint: childName ? 'filled in from the profile' : undefined },
    ...CHILD_GROUPS,
    { kind: 'heading', key: 'about-guide', label: 'About the guide' },
    { kind: 'many', key: 'device_types', label: 'Device type', options: DEVICE_TYPES },
    { kind: 'many', key: 'diff', label: 'Difficulty', options: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }] },
    { kind: 'one', key: 'time', label: 'Build time', options: [{ value: 'any', label: 'Any time' }, { value: '30', label: 'Under 30 min' }, { value: '60', label: 'Under 1 hour' }] },
    { kind: 'many', key: 'parts', label: 'Parts', options: [{ value: 'printable', label: 'Printable parts' }] },
  ]
}

type ListedGuide = Pick<Tutorial, 'id' | 'difficulty' | 'build_minutes' | 'has_stl' | 'created_at'> & Suits

export function guideMatches(t: ListedGuide, v: FilterValues): boolean {
  const time = v.time === 'any' ? null : Number(v.time)
  return (
    (!(v.diff as string[]).length || (v.diff as Difficulty[]).includes(t.difficulty)) &&
    (time === null || (t.build_minutes != null && t.build_minutes <= time)) &&
    (!(v.parts as string[]).length || !!t.has_stl) &&
    matchesSuits(t, suitsFilterOf(v))
  )
}

const DIFF_RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
/** Recommended is byRecommended's order for `child` (newest first without one). */
export function sortGuides<T extends ListedGuide>(list: T[], sort: GuideSort, child: ChildTags | null = null): T[] {
  if (sort === 'recommended') return byRecommended(list, child)
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
export const TOY_DEFAULTS: FilterValues = { show: 'toys', avail: [], cond: [], ...CHILD_DEFAULTS, sort: 'new' }

/** Nearest first only when there is a postcode to measure from. */
export function toyGroups(hasPostcode: boolean): FilterGroup[] {
  return [
    { kind: 'one', key: 'show', label: 'Show', options: [{ value: 'toys', label: 'Toys' }, { value: 'orgs', label: 'Organisations' }] },
    { kind: 'many', key: 'avail', label: 'Availability', options: [{ value: 'available', label: 'Available now' }, { value: 'adapted', label: 'Switch-adapted' }] },
    { kind: 'many', key: 'cond', label: 'Condition', options: GRADES.map((g) => ({ value: g.key, label: g.label })) },
    ...CHILD_GROUPS,
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
