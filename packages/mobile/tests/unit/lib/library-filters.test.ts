import type { ChildProfile } from '@splat-connect/types'
import {
  GUIDE_DEFAULTS,
  TOY_DEFAULTS,
  guideGroups,
  guideMatches,
  sortGuides,
  suitsFilterOf,
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

describe('guideMatches', () => {
  it('keeps everything at the defaults, even an untagged guide with no build time', () => {
    expect(guideMatches(g({ build_minutes: null }), GUIDE_DEFAULTS)).toBe(true)
  })
  it('matches the device type', () => {
    expect(guideMatches(g({ device_types: ['switch'] }), gv({ device_types: ['mounting'] }))).toBe(false)
    expect(guideMatches(g({ device_types: ['switch', 'mounting'] }), gv({ device_types: ['mounting'] }))).toBe(true)
  })
  it('matches any of the chosen difficulties', () => {
    const v = gv({ diff: ['easy', 'hard'] })
    expect(guideMatches(g({ difficulty: 'medium' }), v)).toBe(false)
    expect(guideMatches(g({ difficulty: 'hard' }), v)).toBe(true)
  })
  it('keeps builds at or under the time, and leaves out one with no time', () => {
    expect(guideMatches(g({ build_minutes: 30 }), gv({ time: '30' }))).toBe(true)
    expect(guideMatches(g({ build_minutes: 31 }), gv({ time: '30' }))).toBe(false)
    expect(guideMatches(g({ build_minutes: null }), gv({ time: '60' }))).toBe(false)
  })
  it('keeps only guides with printable parts when asked', () => {
    expect(guideMatches(g({ has_stl: false }), gv({ parts: ['printable'] }))).toBe(false)
    expect(guideMatches(g({ has_stl: true }), gv({ parts: ['printable'] }))).toBe(true)
  })
  it('applies the child questions, leaving out untagged guides while one is filtered', () => {
    const tagged = g({ helps_with: ['moving'], access: ['press', 'head'], one_hand: true, press_force: ['light'], play: ['sound'] })
    expect(guideMatches(tagged, gv({ helps_with: ['moving'] }))).toBe(true)
    expect(guideMatches(tagged, gv({ helps_with: ['seeing'] }))).toBe(false)
    expect(guideMatches(tagged, gv({ access: ['eyes', 'head'] }))).toBe(true)
    expect(guideMatches(tagged, gv({ press_force: ['full'] }))).toBe(false)
    expect(guideMatches(tagged, gv({ play: ['sound'] }))).toBe(true)
    expect(guideMatches(tagged, gv({ access: ['one_hand'] }))).toBe(true)
    // One hand is enough is a chip on access, but needs the guide's own flag.
    expect(guideMatches(g({ access: ['press'] }), gv({ access: ['one_hand'] }))).toBe(false)
    for (const v of [{ helps_with: ['moving'] }, { access: ['press'] }, { press_force: ['light'] }, { play: ['sound'] }, { device_types: ['switch'] }] as FilterValues[]) {
      expect(guideMatches(g(), gv(v))).toBe(false)
    }
  })
  it('needs every filter to hold at once', () => {
    expect(guideMatches(g({ difficulty: 'easy', build_minutes: 90 }), gv({ diff: ['easy'], time: '60' }))).toBe(false)
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
  it('puts the guides sharing most of the child’s answers first, newest first on a tie and without a child', () => {
    const tagged = [
      g({ id: 'none', created_at: '2026-09-01T00:00:00Z' }),
      g({ id: 'one', created_at: '2026-01-01T00:00:00Z', play: ['sound'] }),
      g({ id: 'two', created_at: '2026-02-01T00:00:00Z', play: ['sound'], one_hand: true }),
    ]
    const child = { helps_with: null, access: null, one_hand: true, press_force: null, enjoys: ['sound'] } as never
    expect(sortGuides(tagged, 'recommended', child).map((x) => x.id)).toEqual(['two', 'one', 'none'])
    expect(sortGuides(tagged, 'recommended').map((x) => x.id)).toEqual(['none', 'two', 'one'])
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
  it('applies the child questions, leaving out untagged toys', () => {
    const tagged = t({ helps_with: ['calm'], access: ['touch'], one_hand: true, press_force: ['very_light'], play: ['light'] })
    expect(toyMatches(tagged, tv({ helps_with: ['calm'], access: ['touch', 'one_hand'], press_force: ['very_light'], play: ['light'] }))).toBe(true)
    expect(toyMatches(tagged, tv({ press_force: ['full'] }))).toBe(false)
    expect(toyMatches(t(), tv({ play: ['light'] }))).toBe(false)
    expect(toyMatches(t({ access: ['touch'] }), tv({ access: ['one_hand'] }))).toBe(false)
  })
})

describe('withChildSuggestion', () => {
  const child = (over: Partial<ChildProfile>) => ({ helps_with: [], access: [], one_hand: false, press_force: null, enjoys: [], ...over }) as unknown as ChildProfile

  it('is the values untouched without a child', () => {
    expect(withChildSuggestion(GUIDE_DEFAULTS, undefined)).toBe(GUIDE_DEFAULTS)
  })
  it('suggests the four questions from the child, the same answers with no conversion', () => {
    const v = withChildSuggestion(GUIDE_DEFAULTS, child({ helps_with: ['moving'], access: ['press', 'head'], press_force: 'light', enjoys: ['light', 'water'] }))
    expect(v.helps_with).toEqual(['moving'])
    expect(v.access).toEqual(['press', 'head'])
    expect(v.press_force).toEqual(['light'])
    expect(v.play).toEqual(['light', 'water'])
    expect(v.sort).toBe('recommended')
  })
  it('puts one hand on the access chips, and leaves a missing press force out', () => {
    const v = withChildSuggestion(GUIDE_DEFAULTS, child({ access: ['press'], one_hand: true }))
    expect(v.access).toEqual(['press', 'one_hand'])
    expect(v.press_force).toEqual([])
  })
  it('keeps what is already chosen on those questions, whichever one it is', () => {
    const c = child({ helps_with: ['moving'], enjoys: ['light'] })
    for (const chosen of <FilterValues[]>[{ helps_with: ['seeing'] }, { access: ['eyes'] }, { press_force: ['full'] }, { play: ['calm'] }]) {
      const v = gv(chosen)
      expect(withChildSuggestion(v, c)).toBe(v)
    }
  })
  it('does not touch the non-child filters, so Show keeps them', () => {
    const v = withChildSuggestion(gv({ diff: ['easy'], time: '30' }), child({ helps_with: ['moving'] }))
    expect(v.diff).toEqual(['easy'])
    expect(v.time).toBe('30')
  })
  it('works on the toy defaults too', () => {
    expect(withChildSuggestion(TOY_DEFAULTS, child({ enjoys: ['sound'] })).play).toEqual(['sound'])
  })
})

describe('suitsFilterOf', () => {
  it('splits one_hand off the access chips into its own flag', () => {
    const f = suitsFilterOf(gv({ access: ['press', 'one_hand'], device_types: ['switch'] }))
    expect(f.access).toEqual(['press'])
    expect(f.one_hand).toBe(true)
    expect(f.device_types).toEqual(['switch'])
    expect(suitsFilterOf(gv()).one_hand).toBe(false)
  })
})

describe('groups', () => {
  const keys = (gs: FilterGroup[]) => gs.map((x) => x.key)
  it('orders the guide page: sort, About the child, its four questions, About the guide, then the guide’s own', () => {
    expect(keys(guideGroups('Ollie'))).toEqual(['sort', 'about-child', 'helps_with', 'access', 'press_force', 'play', 'about-guide', 'device_types', 'diff', 'time', 'parts'])
    const gs = guideGroups('Ollie')
    expect(gs.find((x) => x.key === 'about-child')).toMatchObject({ kind: 'heading', label: 'About Ollie' })
    expect(guideGroups(null).find((x) => x.key === 'about-child')).toMatchObject({ label: 'About your child' })
  })
  it('sorts by Recommended first, and puts One hand is enough among the access chips', () => {
    const gs = guideGroups(null)
    const sort = gs.find((x) => x.key === 'sort') as Extract<FilterGroup, { kind: 'one' }>
    expect(sort.options.map((o) => o.label)).toEqual(['Recommended', 'Newest', 'Quickest', 'Easiest'])
    const access = gs.find((x) => x.key === 'access') as Extract<FilterGroup, { kind: 'many' }>
    expect(access.options.map((o) => o.label)).toContain('One hand is enough')
  })
  it('offers Nearest first only with a postcode', () => {
    const sort = (has: boolean) => (toyGroups(has).find((x) => x.key === 'sort') as Extract<FilterGroup, { kind: 'one' }>).options.map((o) => o.label)
    expect(sort(false)).toEqual(['Newest'])
    expect(sort(true)).toEqual(['Newest', 'Nearest first'])
  })
})

describe('filterTags', () => {
  const groups = guideGroups('Ollie')

  it('is empty at the defaults', () => {
    expect(filterTags(groups, GUIDE_DEFAULTS, GUIDE_DEFAULTS)).toEqual([])
  })
  it('makes a tag per chosen many-of option, labelled as the option', () => {
    const tags = filterTags(groups, gv({ diff: ['easy', 'hard'], parts: ['printable'], access: ['one_hand'] }), GUIDE_DEFAULTS)
    expect(tags.map((x) => x.label)).toEqual(['One hand is enough', 'Easy', 'Hard', 'Printable parts'])
  })
  it('makes a tag for a one-of group that is off its default, and none at the default', () => {
    expect(filterTags(groups, gv({ sort: 'quick', time: '30' }), GUIDE_DEFAULTS).map((x) => x.label)).toEqual(['Quickest', 'Under 30 min'])
  })
  it('leaves out the groups it is told are untagged', () => {
    expect(filterTags(groups, gv({ sort: 'quick', diff: ['easy'] }), GUIDE_DEFAULTS, ['sort']).map((x) => x.label)).toEqual(['Easy'])
    expect(filterTags(groups, gv({ sort: 'quick' }), GUIDE_DEFAULTS).map((x) => x.label)).toEqual(['Quickest'])
  })
  it('removing a tag returns values without it and with everything else', () => {
    const v = gv({ diff: ['easy', 'hard'], sort: 'quick', helps_with: ['moving', 'calm'] })
    const by = (label: string) => filterTags(groups, v, GUIDE_DEFAULTS).find((x) => x.label === label)!
    expect(by('Easy').remove(v).diff).toEqual(['hard'])
    expect(by('Quickest').remove(v).sort).toBe('recommended')
    expect(by('Feeling calm').remove(v).helps_with).toEqual(['moving'])
    expect(by('Easy').remove(v).sort).toBe('quick')
    // The values it was given are not changed.
    expect(v.diff).toEqual(['easy', 'hard'])
    expect(v.helps_with).toEqual(['moving', 'calm'])
  })
  it('makes no tag for a heading', () => {
    expect(filterTags(groups, gv(), GUIDE_DEFAULTS).length).toBe(0)
  })
  it('gives each tag a distinct key', () => {
    const keys = filterTags(groups, gv({ diff: ['easy', 'hard'], helps_with: ['moving'] }), GUIDE_DEFAULTS).map((x) => x.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
