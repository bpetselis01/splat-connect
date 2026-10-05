/**
 * The Map tab's places (GET /api/public/map). A place is a suburb; its point is
 * the mean of the ABS postcode centres of the rows in it, rounded to 3 places,
 * as impact_map() (121) does. No address is read and no geocoder is called.
 */
import type { MapItem, MapPlace } from '@splat-connect/types'

export type Located = MapItem & { suburb: string | null; state: string | null; postcode: string | null }
export type Point = { lat: number; lng: number }

const round3 = (n: number) => Math.round(n * 1000) / 1000
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

/** Whole km between two points (haversine). */
export function kmBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)))
}

/** Rows grouped by suburb and state. A suburb with no known postcode centre is left off. */
export function groupPlaces(rows: Located[], centres: Map<string, Point>, origin: Point | null): MapPlace[] {
  const groups = new Map<string, { suburb: string; state: string; points: Point[]; items: MapItem[] }>()
  for (const { suburb, state, postcode, ...item } of rows) {
    const s = suburb?.trim()
    const st = state?.trim().toUpperCase()
    if (!s || !st) continue
    const key = `${s.toLowerCase()}|${st}`
    const g = groups.get(key) ?? { suburb: titleCase(s), state: st, points: [], items: [] }
    const centre = postcode ? centres.get(postcode.trim()) : undefined
    if (centre) g.points.push(centre)
    g.items.push(item)
    groups.set(key, g)
  }
  const places: MapPlace[] = []
  for (const g of groups.values()) {
    if (!g.points.length) continue
    const lat = round3(g.points.reduce((n, p) => n + p.lat, 0) / g.points.length)
    const lng = round3(g.points.reduce((n, p) => n + p.lng, 0) / g.points.length)
    places.push({ suburb: g.suburb, state: g.state, lat, lng, km: origin ? kmBetween(origin, { lat, lng }) : null, items: g.items })
  }
  return places.sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.suburb.localeCompare(b.suburb))
}
