import { describe, it, expect } from 'vitest'
import { groupPlaces, kmBetween, type Located } from '../../src/map.js'

const row = (over: Partial<Located>): Located => ({ kind: 'toy', id: 'x', title: 'T', meta: null, suburb: 'Newtown', state: 'NSW', postcode: '2042', ...over })
const centres = new Map([
  ['2042', { lat: -33.9, lng: 151.18 }],
  ['2043', { lat: -33.902, lng: 151.182 }],
  ['2040', { lat: -33.88, lng: 151.155 }],
])

describe('groupPlaces', () => {
  it('merges one suburb spelt two ways and averages its postcode centres', () => {
    const [p, ...rest] = groupPlaces([row({ id: 'a' }), row({ id: 'b', suburb: ' newtown ', state: 'nsw', postcode: '2043' })], centres, null)
    expect(rest).toEqual([])
    expect(p).toMatchObject({ suburb: 'Newtown', state: 'NSW', lat: -33.901, lng: 151.181, km: null })
    expect(p.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(p.items[0]).not.toHaveProperty('postcode')
  })

  it('a row with no postcode still joins a suburb that has a point', () => {
    const [p] = groupPlaces([row({ id: 'a' }), row({ id: 'e', kind: 'event', postcode: null })], centres, null)
    expect(p.items).toHaveLength(2)
  })

  it('leaves off a suburb with no known centre, and rows with no suburb or state', () => {
    expect(groupPlaces([row({ postcode: '9999' }), row({ suburb: null }), row({ state: '  ' })], centres, null)).toEqual([])
  })

  it('measures from the origin and sorts nearest first', () => {
    const places = groupPlaces([row({ id: 'far', suburb: 'Leichhardt', postcode: '2040' }), row({ id: 'near' })], centres, centres.get('2042')!)
    expect(places.map((p) => [p.suburb, p.km])).toEqual([['Newtown', 0], ['Leichhardt', 3]])
  })
})

it('kmBetween: Sydney to Melbourne is about 713 km', () => {
  expect(kmBetween({ lat: -33.8688, lng: 151.2093 }, { lat: -37.8136, lng: 144.9631 })).toBe(713)
})
