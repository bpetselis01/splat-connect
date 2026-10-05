import { describe, it, expect } from 'vitest'
import { NO_SUITS_FILTER } from '@splat-connect/types'
import { filterGuides, sortGuides } from '@/lib/library-filter'

const g = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Guide ${id}`,
  difficulty: 'easy' as const,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null as string | null,
  build_minutes: 30 as number | null,
  has_stl: false,
  ...over,
})

const ids = (list: { id: string }[]) => list.map((t) => t.id)

describe('filterGuides', () => {
  const list = [
    g('a', { build_minutes: 20 }),
    g('b', { build_minutes: 45, has_stl: true, difficulty: 'hard' }),
    g('c', { build_minutes: 90 }),
    g('d', { build_minutes: null }),
  ]

  it('treats Under 1 hour as including Under 30 min, on hands-on time only', () => {
    expect(ids(filterGuides(list, { time: 'u30' }))).toEqual(['a'])
    expect(ids(filterGuides(list, { time: 'u60' }))).toEqual(['a', 'b'])
  })

  it('reads Needs printing from STL files, not from the time', () => {
    expect(ids(filterGuides(list, { time: 'print' }))).toEqual(['b'])
  })

  it('ANDs facets together and with the header search', () => {
    expect(ids(filterGuides(list, { skill: 'hard', time: 'u60' }))).toEqual(['b'])
    expect(ids(filterGuides(list, { skill: 'easy' }, 'guide c'))).toEqual(['c'])
  })

  it('returns everything with no facet set', () => {
    expect(filterGuides(list, {})).toHaveLength(4)
  })
})

describe('filterGuides tags', () => {
  const list = [
    g('a', { device_types: ['switch'], access: ['press'], one_hand: true }),
    g('b', { device_types: ['switch', 'mounting'], access: ['eyes'] }),
    g('c'),
  ]
  const suits = (over: Record<string, unknown>) => ({ suits: { ...NO_SUITS_FILTER, ...over } })

  it('matches any choice within a group and leaves untagged guides out while it is filtered', () => {
    expect(ids(filterGuides(list, suits({ access: ['press', 'eyes'] })))).toEqual(['a', 'b'])
  })

  it('needs every filtered group to match', () => {
    expect(ids(filterGuides(list, suits({ device_types: ['switch'], access: ['eyes'] })))).toEqual(['b'])
  })

  it('reads "One hand is enough" as one_hand', () => {
    expect(ids(filterGuides(list, suits({ one_hand: true })))).toEqual(['a'])
  })
})

describe('sortGuides', () => {
  it('Recommended puts the child\'s matches first, then newest', () => {
    const list = [
      g('plain-new', { created_at: '2026-03-01T00:00:00Z' }),
      g('match', { created_at: '2026-01-01T00:00:00Z', access: ['eyes'] }),
      g('plain-old', { created_at: '2026-02-01T00:00:00Z' }),
    ]
    const child = { helps_with: [], access: ['eyes' as const], one_hand: false, press_force: null, enjoys: [] }
    expect(ids(sortGuides(list, 'recommended', child))).toEqual(['match', 'plain-new', 'plain-old'])
    expect(ids(sortGuides(list, 'recommended'))).toEqual(['plain-new', 'plain-old', 'match'])
  })

  it('puts an untimed guide last under Quickest', () => {
    const list = [g('none', { build_minutes: null }), g('long', { build_minutes: 90 }), g('short', { build_minutes: 15 })]
    expect(ids(sortGuides(list, 'quick'))).toEqual(['short', 'long', 'none'])
  })

  it('ranks difficulty easy < medium < hard under Easiest, not alphabetically', () => {
    const list = [g('h', { difficulty: 'hard' }), g('e'), g('m', { difficulty: 'medium' })]
    expect(ids(sortGuides(list, 'easy'))).toEqual(['e', 'm', 'h'])
  })

  it('dates a guide by when it was approved, falling back to its draft', () => {
    const list = [
      g('old-draft-new-approval', { created_at: '2025-01-01T00:00:00Z', reviewed_at: '2026-06-01T00:00:00Z' }),
      g('never-reviewed', { created_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(ids(sortGuides(list, 'new'))).toEqual(['old-draft-new-approval', 'never-reviewed'])
  })
})
