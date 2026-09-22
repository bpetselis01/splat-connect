import { describe, it, expect } from 'vitest'
import { filterGuides, sortGuides } from '@/lib/library-filter'

const g = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Guide ${id}`,
  difficulty: 'easy' as const,
  kind: 'toy_adaptation' as const,
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
    g('b', { build_minutes: 45, kind: 'assistive_tech', has_stl: true, difficulty: 'hard' }),
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
    expect(ids(filterGuides(list, { type: 'assistive_tech', skill: 'hard' }))).toEqual(['b'])
    expect(ids(filterGuides(list, { skill: 'easy' }, 'guide c'))).toEqual(['c'])
  })

  it('returns everything with no facet set', () => {
    expect(filterGuides(list, {})).toHaveLength(4)
  })
})

describe('sortGuides', () => {
  it('puts an untimed guide last in both directions', () => {
    const list = [g('none', { build_minutes: null }), g('long', { build_minutes: 90 }), g('short', { build_minutes: 15 })]
    expect(ids(sortGuides(list, 'time', 'asc'))).toEqual(['short', 'long', 'none'])
    expect(ids(sortGuides(list, 'time', 'desc'))).toEqual(['long', 'short', 'none'])
  })

  it('ranks difficulty easy < medium < hard, not alphabetically', () => {
    const list = [g('h', { difficulty: 'hard' }), g('e'), g('m', { difficulty: 'medium' })]
    expect(ids(sortGuides(list, 'diff', 'asc'))).toEqual(['e', 'm', 'h'])
  })

  it('dates a guide by when it was approved, falling back to its draft', () => {
    const list = [
      g('old-draft-new-approval', { created_at: '2025-01-01T00:00:00Z', reviewed_at: '2026-06-01T00:00:00Z' }),
      g('never-reviewed', { created_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(ids(sortGuides(list, 'new', 'desc'))).toEqual(['old-draft-new-approval', 'never-reviewed'])
  })
})
