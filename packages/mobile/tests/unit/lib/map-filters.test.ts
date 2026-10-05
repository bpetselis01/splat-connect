import type { MapPlace } from '@splat-connect/types'
import { applyFilters, filterCount, itemMeta, itemRoute, KIND_ORDER, NO_FILTERS, toFeatures } from '../../../lib/map-filters'

const all = new Set(KIND_ORDER)
// Wed 1 Oct 2026, local time.
const now = new Date(2026, 9, 1, 9).getTime()
const place = (over: Partial<MapPlace>): MapPlace => ({ suburb: 'Newtown', state: 'NSW', lat: -33.9, lng: 151.18, km: 2, address: null, items: [], ...over })
const places: MapPlace[] = [
  place({
    items: [
      { kind: 'printer', id: 'p1', title: 'Prusa', meta: 'PLA', materials: ['PLA'] },
      { kind: 'dropoff', id: 'o1', title: 'Lab', meta: 'Takes PETG', materials: ['PETG'] },
      { kind: 'toy', id: 't1', title: 'Rings', meta: null },
    ],
  }),
  place({
    suburb: 'Chatswood',
    km: 12,
    items: [
      { kind: 'event', id: 'sat', title: 'Build day', meta: null, starts_at: new Date(2026, 9, 3, 10).toISOString() },
      { kind: 'event', id: 'later', title: 'Workshop', meta: null, starts_at: new Date(2026, 9, 28, 10).toISOString() },
    ],
  }),
  place({ suburb: 'Nowhere', km: null, items: [{ kind: 'org', id: 'o9', title: 'Far', meta: null }] }),
]
const ids = (ps: MapPlace[]) => ps.flatMap((p) => p.items.map((i) => i.id))

describe('applyFilters', () => {
  it('keeps everything with no filters and every layer on', () => {
    expect(ids(applyFilters(places, all, NO_FILTERS, now))).toEqual(['p1', 'o1', 't1', 'sat', 'later', 'o9'])
  })

  it('a hidden layer drops its items, and a place left empty drops out', () => {
    const shown = applyFilters(places, new Set(['event'] as const), NO_FILTERS, now)
    expect(shown.map((p) => p.suburb)).toEqual(['Chatswood'])
  })

  it('distance keeps places within the radius and drops places with no distance', () => {
    expect(applyFilters(places, all, { ...NO_FILTERS, within: 5 }, now).map((p) => p.suburb)).toEqual(['Newtown'])
  })

  it('filament narrows printers and drop-offs only', () => {
    expect(ids(applyFilters(places, all, { ...NO_FILTERS, materials: ['PETG'] }, now))).toEqual(['o1', 't1', 'sat', 'later', 'o9'])
  })

  it('event dates: next two weeks, and weekends', () => {
    expect(ids(applyFilters(places, all, { ...NO_FILTERS, when: 'fortnight' }, now))).not.toContain('later')
    expect(ids(applyFilters(places, all, { ...NO_FILTERS, when: 'weekend' }, now))).toEqual(['p1', 'o1', 't1', 'sat', 'o9'])
  })
})

it('filterCount counts distance, each filament and the date choice', () => {
  expect(filterCount(NO_FILTERS)).toBe(0)
  expect(filterCount({ within: 5, materials: ['PLA', 'TPU'], when: 'weekend' })).toBe(4)
})

it('itemRoute and itemMeta', () => {
  expect(itemRoute({ kind: 'toy', id: 't1', title: '', meta: null })).toBe('/toy-library/t1')
  expect(itemRoute({ kind: 'event', id: 'e1', title: '', meta: null })).toBe('/news/event/e1')
  expect(itemRoute({ kind: 'org', id: 'o1', title: '', meta: null })).toBe('/toy-library/organisation/o1')
  expect(itemMeta({ kind: 'printer', id: 'p', title: '', meta: 'PLA, PETG' })).toBe('Printer · PLA, PETG')
  expect(itemMeta({ kind: 'toy', id: 't', title: '', meta: null })).toBe('Toy')
})

describe('toFeatures', () => {
  it('one point per item; a lone item sits on its suburb, several fan out close by', () => {
    const fc = toFeatures([places[0], place({ suburb: 'Solo', items: [{ kind: 'org', id: 'o', title: 'O', meta: null }] })])
    expect(fc.features).toHaveLength(4)
    expect(fc.features[3].geometry.coordinates).toEqual([151.18, -33.9])
    expect(fc.features[3].properties).toEqual({ place: '-33.9,151.18', item: 'org:o', color: expect.any(String) })
    const fan = fc.features.slice(0, 3).map((f) => f.geometry.coordinates)
    expect(new Set(fan.map(String)).size).toBe(3)
    for (const [lng, lat] of fan) {
      expect(Math.abs(lng - 151.18)).toBeLessThan(0.001)
      expect(Math.abs(lat + 33.9)).toBeLessThan(0.001)
    }
  })
})
