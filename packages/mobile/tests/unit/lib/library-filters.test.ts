import type { ChildProfile } from '@splat-connect/types'
import {
  GUIDE_DEFAULTS,
  TOY_DEFAULTS,
  guideGroups,
  guideMatches,
  sortGuides,
  toyGroups,
  toyMatches,
  withChildSuggestion,
} from '../../../lib/library-filters'
import { filterTags, type FilterGroup, type FilterValues } from '../../../components/library/filter-page'

type G = Parameters<typeof guideMatches>[0]
const g = (over: Partial<G> = {}): G => ({ id: 'g1', kind: 'toy_adaptation', difficulty: 'easy', build_minutes: 20, has_stl: false, created_at: '2026-06-01T00:00:00Z', ...over }) as G
type T = Parameters<typeof toyMatches>[0]
const t = (over: Partial<T> = {}): T => ({ condition: 8, switch_adapted: false, quantity: 1, ...over })
const gv = (over: FilterValues = {}): FilterValues => ({ ...GUIDE_DEFAULTS, ...over })
const tv = (over: FilterValues = {}): FilterValues => ({ ...TOY_DEFAULTS, ...over })
const none = new Set<string>()

describe('guideMatches', () => {
  it('keeps everything at the defaults, even an untagged guide with no build time', () => {
    expect(guideMatches(g({ build_minutes: null }), GUIDE_DEFAULTS, none)).toBe(true)
  })
  it('matches the guide type', () => {
    expect(guideMatches(g({ kind: 'assistive_tech' }), gv({ type: 'toy_adaptation' }), none)).toBe(false)
    expect(guideMatches(g({ kind: 'assistive_tech' }), gv({ type: 'assistive_tech' }), none)).toBe(true)
  })
  it('matches any of the chosen difficulties', () => {
    const v = gv({ diff: ['easy', 'hard'] })
    expect(guideMatches(g({ difficulty: 'medium' }), v, none)).toBe(false)
    expect(guideMatches(g({ difficulty: 'hard' }), v, none)).toBe(true)
  })
  it('keeps builds at or under the time, and leaves out one with no time', () => {
    expect(guideMatches(g({ build_minutes: 30 }), gv({ time: '30' }), none)).toBe(true)
    expect(guideMatches(g({ build_minutes: 31 }), gv({ time: '30' }), none)).toBe(false)
    expect(guideMatches(g({ build_minutes: null }), gv({ time: '60' }), none)).toBe(false)
  })
  it('keeps only guides with printable parts when asked', () => {
    expect(guideMatches(g({ has_stl: false }), gv({ parts: ['printable'] }), none)).toBe(false)
    expect(guideMatches(g({ has_stl: true }), gv({ parts: ['printable'] }), none)).toBe(true)
  })
  it('keeps only the guides that suit a child when For your child is on', () => {
    expect(guideMatches(g({ id: 'a' }), gv({ suits: ['suits'] }), new Set(['b']))).toBe(false)
    expect(guideMatches(g({ id: 'b' }), gv({ suits: ['suits'] }), new Set(['b']))).toBe(true)
  })
  it('applies the suits questions, leaving out untagged guides while one is filtered', () => {
    const tagged = g({ movement: ['lever'], hands: ['left'], play: ['sound'], fit: { reach_cm: [20, 40] } })
    expect(guideMatches(tagged, gv({ movement: ['lever'] }), none)).toBe(true)
    expect(guideMatches(tagged, gv({ movement: ['press'] }), none)).toBe(false)
    expect(guideMatches(g(), gv({ movement: ['lever'] }), none)).toBe(false)
    expect(guideMatches(g(), gv({ hands: ['left'] }), none)).toBe(false)
    expect(guideMatches(g(), gv({ play: ['sound'] }), none)).toBe(false)
    expect(guideMatches(tagged, gv({ fit: { reach_cm: 30 } }), none)).toBe(true)
    expect(guideMatches(tagged, gv({ fit: { reach_cm: 41 } }), none)).toBe(false)
    expect(guideMatches(g(), gv({ fit: { reach_cm: 30 } }), none)).toBe(false)
  })
  it('needs every filter to hold at once', () => {
    expect(guideMatches(g({ difficulty: 'easy', build_minutes: 90 }), gv({ diff: ['easy'], time: '60' }), none)).toBe(false)
  })
})

describe('sortGuides', () => {
  const list = [
    g({ id: 'old', created_at: '2026-01-01T00:00:00Z', build_minutes: 90, difficulty: 'hard' }),
    g({ id: 'new', created_at: '2026-09-01T00:00:00Z', build_minutes: 30, difficulty: 'medium' }),
    g({ id: 'quick', created_at: '2026-05-01T00:00:00Z', build_minutes: 5, difficulty: 'hard' }),
    g({ id: 'nobuild', created_at: '', build_minutes: null, difficulty: 'easy' }),
  ]
  const ids = (s: Parameters<typeof sortGuides>[1]) => sortGuides(list, s).map((x) => x.id)
  it('puts the newest first, and an unreadable date last', () => {
    expect(ids('new')).toEqual(['new', 'quick', 'old', 'nobuild'])
  })
  it('puts the quickest first, and no build time last', () => {
    expect(ids('quick')).toEqual(['quick', 'new', 'old', 'nobuild'])
  })
  it('puts the easiest first, ties by build time', () => {
    expect(ids('easy')).toEqual(['nobuild', 'new', 'quick', 'old'])
  })
  it('does not reorder the list it was given', () => {
    const before = list.map((x) => x.id)
    sortGuides(list, 'quick')
    expect(list.map((x) => x.id)).toEqual(before)
  })
})

describe('toyMatches', () => {
  it('keeps everything at the defaults', () => {
    expect(toyMatches(t({ quantity: 0 }), TOY_DEFAULTS)).toBe(true)
  })
  it('Available now leaves out a toy with none left', () => {
    expect(toyMatches(t({ quantity: 0 }), tv({ avail: ['available'] }))).toBe(false)
    expect(toyMatches(t({ quantity: 3 }), tv({ avail: ['available'] }))).toBe(true)
  })
  it('Switch-adapted leaves out a toy that is not', () => {
    expect(toyMatches(t(), tv({ avail: ['adapted'] }))).toBe(false)
    expect(toyMatches(t({ switch_adapted: true }), tv({ avail: ['adapted'] }))).toBe(true)
  })
  it('matches the condition by its grade', () => {
    expect(toyMatches(t({ condition: 9 }), tv({ cond: ['like-new'] }))).toBe(true)
    expect(toyMatches(t({ condition: 8 }), tv({ cond: ['like-new'] }))).toBe(false)
    expect(toyMatches(t({ condition: 8 }), tv({ cond: ['like-new', 'good'] }))).toBe(true)
    expect(toyMatches(t({ condition: -1 }), tv({ cond: ['needs-fix'] }))).toBe(true)
  })
  it('applies the suits questions, leaving out untagged toys', () => {
    const tagged = t({ movement: ['press'], hands: ['both'], play: ['light'], fit: { tray_mm: [5, 20] } })
    expect(toyMatches(tagged, tv({ movement: ['press'], hands: ['both'], play: ['light'], fit: { tray_mm: 10 } }))).toBe(true)
    expect(toyMatches(tagged, tv({ fit: { tray_mm: 30 } }))).toBe(false)
    expect(toyMatches(t(), tv({ play: ['light'] }))).toBe(false)
  })
})

describe('withChildSuggestion', () => {
  const child = (over: Partial<ChildProfile>) => ({ working_hand: null, enjoys: [], palm_width_mm: null, reach_cm: null, tray_mm: null, ...over }) as ChildProfile

  it('is the values untouched without a child', () => {
    expect(withChildSuggestion(GUIDE_DEFAULTS, undefined)).toBe(GUIDE_DEFAULTS)
  })
  it('suggests hands, play and measurements from the child', () => {
    const v = withChildSuggestion(GUIDE_DEFAULTS, child({ working_hand: 'left', enjoys: ['light', 'water'], palm_width_mm: 60, reach_cm: 30 }))
    expect(v.hands).toEqual(['left'])
    expect(v.play).toEqual(['light', 'water'])
    expect(v.fit).toEqual({ palm_width_mm: 60, reach_cm: 30 })
    expect(v.movement).toEqual([])
    expect(v.sort).toBe('new')
  })
  it('reads either hand as both, right as right, and an unknown hand as none', () => {
    expect(withChildSuggestion(GUIDE_DEFAULTS, child({ working_hand: 'either' })).hands).toEqual(['both'])
    expect(withChildSuggestion(GUIDE_DEFAULTS, child({ working_hand: 'right' })).hands).toEqual(['right'])
    expect(withChildSuggestion(GUIDE_DEFAULTS, child({})).hands).toEqual([])
  })
  it('leaves out a measurement the child has not given', () => {
    expect(withChildSuggestion(GUIDE_DEFAULTS, child({ tray_mm: 12 })).fit).toEqual({ tray_mm: 12 })
  })
  it('keeps what is already chosen on those questions, whichever one it is', () => {
    const c = child({ working_hand: 'left', enjoys: ['light'] })
    for (const chosen of <FilterValues[]>[{ movement: ['lever'] }, { hands: ['right'] }, { play: ['calm'] }, { fit: { tray_mm: 10 } }]) {
      const v = gv(chosen)
      expect(withChildSuggestion(v, c)).toBe(v)
    }
  })
  it('does not touch the non-suits filters, so Show keeps them', () => {
    const v = withChildSuggestion(gv({ diff: ['easy'], time: '30' }), child({ working_hand: 'left' }))
    expect(v.diff).toEqual(['easy'])
    expect(v.time).toBe('30')
  })
  it('works on the toy defaults too', () => {
    expect(withChildSuggestion(TOY_DEFAULTS, child({ enjoys: ['sound'] })).play).toEqual(['sound'])
  })
})

describe('groups', () => {
  const keys = (gs: FilterGroup[]) => gs.map((x) => x.key)
  it('leaves out For your child unless a label is given', () => {
    expect(keys(guideGroups(null))).not.toContain('suits')
    expect(keys(guideGroups('Suits Ollie · 2'))).toContain('suits')
  })
  it('offers Nearest first only with a postcode', () => {
    const sort = (has: boolean) => (toyGroups(has).find((x) => x.key === 'sort') as Extract<FilterGroup, { kind: 'one' }>).options.map((o) => o.label)
    expect(sort(false)).toEqual(['Newest'])
    expect(sort(true)).toEqual(['Newest', 'Nearest first'])
  })
})

describe('filterTags', () => {
  const groups = guideGroups('Suits Ollie · 2')

  it('is empty at the defaults', () => {
    expect(filterTags(groups, GUIDE_DEFAULTS, GUIDE_DEFAULTS)).toEqual([])
  })
  it('makes a tag per chosen many-of option, labelled as the option', () => {
    const tags = filterTags(groups, gv({ diff: ['easy', 'hard'], parts: ['printable'], suits: ['suits'] }), GUIDE_DEFAULTS)
    expect(tags.map((x) => x.label)).toEqual(['Suits Ollie · 2', 'Easy', 'Hard', 'Printable parts'])
  })
  it('makes a tag for a one-of group that is off its default, and none at the default', () => {
    expect(filterTags(groups, gv({ type: 'assistive_tech', time: '30' }), GUIDE_DEFAULTS).map((x) => x.label)).toEqual(['Assistive tech', 'Under 30 min'])
  })
  it('leaves out the groups it is told are untagged', () => {
    expect(filterTags(groups, gv({ sort: 'quick', diff: ['easy'] }), GUIDE_DEFAULTS, ['sort']).map((x) => x.label)).toEqual(['Easy'])
    expect(filterTags(groups, gv({ sort: 'quick' }), GUIDE_DEFAULTS).map((x) => x.label)).toEqual(['Quickest'])
  })
  it('labels a measurement with its name, number and unit', () => {
    const tags = filterTags(groups, gv({ fit: { palm_width_mm: 60, reach_cm: 30, tray_mm: 12 } }), GUIDE_DEFAULTS)
    expect(tags.map((x) => x.label)).toEqual(['Hand width 60 mm', 'Reach from seated 30 cm', 'Tray thickness 12 mm'])
  })
  it('removing a tag returns values without it and with everything else', () => {
    const v = gv({ diff: ['easy', 'hard'], type: 'assistive_tech', fit: { palm_width_mm: 60, tray_mm: 12 } })
    const by = (label: string) => filterTags(groups, v, GUIDE_DEFAULTS).find((x) => x.label === label)!
    expect(by('Easy').remove(v).diff).toEqual(['hard'])
    expect(by('Assistive tech').remove(v).type).toBe('all')
    expect(by('Hand width 60 mm').remove(v).fit).toEqual({ tray_mm: 12 })
    expect(by('Easy').remove(v).type).toBe('assistive_tech')
    // The values it was given are not changed.
    expect(v.diff).toEqual(['easy', 'hard'])
    expect(v.fit).toEqual({ palm_width_mm: 60, tray_mm: 12 })
  })
  it('gives each tag a distinct key', () => {
    const keys = filterTags(groups, gv({ diff: ['easy', 'hard'], fit: { palm_width_mm: 60 } }), GUIDE_DEFAULTS).map((x) => x.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

it('leaves out a saved measurement outside the page’s range, so opening never shows Show 0 for it', () => {
  const v = withChildSuggestion(GUIDE_DEFAULTS, { palm_width_mm: 6, reach_cm: 30 } as never)
  expect(v.fit).toEqual({ reach_cm: 30 })
})
