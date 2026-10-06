import { describe, it, expect } from 'vitest'
import { groupPlaces, kmBetween, type Located } from '../../src/map.js'
import { addressQuery, narrowings } from '../../src/geocode.js'

const row = (over: Partial<Located>): Located => ({
  kind: 'toy', id: 'x', title: 'T', meta: null,
  suburb: 'Newtown', state: 'NSW', postcode: '2042', query: null, address: null,
  ...over,
})
const centres = new Map([
  ['2042', { lat: -33.9, lng: 151.18 }],
  ['2040', { lat: -33.88, lng: 151.155 }],
])
const HALL = '1 King St, Newtown NSW 2042, Australia'
const points = new Map([
  [HALL, { lat: -33.8971234, lng: 151.1795678 }],
  ['Nowhere Rd, Australia', null],
])

describe('groupPlaces', () => {
  it('a geocoded row sits at its address, with the street line, and rows at one address share a place', () => {
    const [p, ...rest] = groupPlaces(
      [row({ id: 'org', kind: 'org', query: HALL, address: '1 King St' }), row({ id: 'drop', kind: 'dropoff', query: HALL, address: '1 King St' })],
      points, centres, null
    )
    expect(rest).toEqual([])
    expect(p).toMatchObject({ suburb: 'Newtown', state: 'NSW', lat: -33.89712, lng: 151.17957, address: '1 King St', km: null })
    expect(p.items.map((i) => i.id)).toEqual(['org', 'drop'])
    expect(p.items[0]).not.toHaveProperty('query')
    expect(p.items[0]).not.toHaveProperty('postcode')
  })

  it('not found, or not looked up yet, falls back to the postcode centre', () => {
    const places = groupPlaces([row({ id: 'a', query: 'Nowhere Rd, Australia' }), row({ id: 'b', query: 'Pending St, Australia' })], points, centres, null)
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({ lat: -33.9, lng: 151.18 })
    expect(places[0].items).toHaveLength(2)
  })

  it('leaves off a row with no point and no known postcode', () => {
    expect(groupPlaces([row({ postcode: '9999' }), row({ postcode: null })], points, centres, null)).toEqual([])
  })

  it('measures from the origin and sorts nearest first', () => {
    const places = groupPlaces([row({ id: 'far', suburb: 'Leichhardt', postcode: '2040' }), row({ id: 'near' })], points, centres, centres.get('2042')!)
    expect(places.map((p) => [p.suburb, p.km])).toEqual([['Newtown', 0], ['Leichhardt', 3]])
  })
})

it('narrowings drop the leading part, down to the locality', () => {
  expect(narrowings('Makerspace, Building ES, University Drive, Callaghan NSW 2308, Australia')).toEqual([
    'Makerspace, Building ES, University Drive, Callaghan NSW 2308, Australia',
    'Building ES, University Drive, Callaghan NSW 2308, Australia',
    'University Drive, Callaghan NSW 2308, Australia',
    'Callaghan NSW 2308, Australia',
  ])
  expect(narrowings('Newcastle NSW, Australia')).toEqual(['Newcastle NSW, Australia'])
})

describe('addressQuery', () => {
  it('trims, drops blanks, collapses spaces and ends with Australia', () => {
    expect(addressQuery(['  1  King St ', null, '', 'Newtown NSW 2042'])).toBe('1 King St, Newtown NSW 2042, Australia')
  })
  it('is null with nothing to look up', () => {
    expect(addressQuery([null, '  '])).toBeNull()
  })
})

it('kmBetween: Sydney to Melbourne is about 713 km', () => {
  expect(kmBetween({ lat: -33.8688, lng: 151.2093 }, { lat: -37.8136, lng: 144.9631 })).toBe(713)
})
