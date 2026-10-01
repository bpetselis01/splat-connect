import { describe, it, expect } from 'vitest'
import { autoPicks, initialPicks, MAX_PICKS, pickOptions, PICK_KIND_LABEL, samePick } from '@splat-connect/types'

const row = (id: string, created_at: string, owner_id: string | null = 'p1', owner_org_id: string | null = null) => ({ id, created_at, owner_id, owner_org_id })

describe('autoPicks', () => {
  it("is up to three of the holder's other toys, newest first", () => {
    const listed = [row('a', '2026-01-01'), row('b', '2026-02-01'), row('c', '2026-03-01'), row('d', '2026-04-01'), row('e', '2026-05-01'), row('x', '2026-06-01', 'p2')]
    expect(autoPicks(row('a', ''), listed).map((t) => t.id)).toEqual(['e', 'd', 'c'])
  })
  it("matches an organisation's toys by the organisation, not a person", () => {
    const listed = [row('o1', '2026-01-01', null, 'org1'), row('o2', '2026-02-01', null, 'org1'), row('p', '2026-03-01', null, 'org2')]
    expect(autoPicks(row('o1', '', null, 'org1'), listed).map((t) => t.id)).toEqual(['o2'])
  })
  it('is empty for a holder with nothing else listed', () => {
    expect(autoPicks(row('a', ''), [row('a', '2026-01-01')])).toEqual([])
  })
  it("names each kind in the board's words", () => {
    expect(PICK_KIND_LABEL).toEqual({ toy: 'Toy in the library', toy_adaptation: 'Toy adaptation guide', assistive_tech: 'Assistive tech guide' })
  })
})

describe('the picks editors', () => {
  it('allows three', () => {
    expect(MAX_PICKS).toBe(3)
  })
  it('matches a pick by its kind and id', () => {
    expect(samePick({ entity_type: 'toy', entity_id: 'a' }, { entity_type: 'toy', entity_id: 'a' })).toBe(true)
    expect(samePick({ entity_type: 'toy', entity_id: 'a' }, { entity_type: 'tutorial', entity_id: 'a' })).toBe(false)
  })
  it('starts from the saved picks in position order', () => {
    const toy_picks = [
      { position: 2, entity_type: 'toy' as const, entity_id: 't2' },
      { position: 1, entity_type: 'tutorial' as const, entity_id: 'g1' },
    ]
    expect(initialPicks({ toy_picks })).toEqual([{ entity_type: 'tutorial', entity_id: 'g1' }, { entity_type: 'toy', entity_id: 't2' }])
    expect(initialPicks({})).toEqual([])
  })
  it("offers the holder's other listed, unretired toys, then the guides", () => {
    const own = [
      { id: 't1', name: 'Itself', status: 'published' as const },
      { id: 't2', name: 'Robot', status: 'published' as const },
      { id: 't3', name: 'Draft', status: 'draft' as const },
      { id: 't4', name: 'Broken', status: 'published' as const, retired_at: '2026-09-01' },
    ]
    expect(pickOptions({ id: 't1' }, own, [{ id: 'g1', title: 'Switch mount' }])).toEqual([
      { pick: { entity_type: 'toy', entity_id: 't2' }, label: 'Robot' },
      { pick: { entity_type: 'tutorial', entity_id: 'g1' }, label: 'Switch mount' },
    ])
  })
})
