/**
 * The Map tab's places (GET /api/public/map). A place is a point: an
 * organisation's address, an event's venue, or a suburb's centre for an
 * individual (spec 2026-10-05-map-addresses). Points come from geocode.ts; a
 * row it could not place falls back to its postcode centre (099).
 */
import type { MapItem, MapPlace } from '@splat-connect/types'
import type { Point } from './geocode.js'

export type Located = MapItem & {
  suburb: string | null
  state: string | null
  postcode: string | null
  /** What geocode.ts looks up for this row; null for none. */
  query: string | null
  /** The street line, for organisation-located rows only. */
  address: string | null
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

/** Whole km between two points (haversine). */
export function kmBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)))
}

/** Rows grouped by the point they sit at. A row with no geocoded point and no postcode centre is left off. */
export function groupPlaces(
  rows: Located[],
  points: Map<string, Point | null>,
  centres: Map<string, Point>,
  origin: Point | null
): MapPlace[] {
  const groups = new Map<string, MapPlace>()
  for (const { suburb, state, postcode, query, address, ...item } of rows) {
    const at = (query ? points.get(query) : null) ?? (postcode ? centres.get(postcode.trim()) : undefined)
    if (!at) continue
    const lat = round5(at.lat)
    const lng = round5(at.lng)
    const key = `${lat},${lng}`
    const g = groups.get(key) ?? {
      suburb: suburb?.trim() ? titleCase(suburb.trim()) : '',
      state: state?.trim().toUpperCase() ?? '',
      lat,
      lng,
      address: address?.trim() || null,
      km: origin ? kmBetween(origin, { lat, lng }) : null,
      items: [],
    }
    g.items.push(item)
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.suburb.localeCompare(b.suburb))
}
