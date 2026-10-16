// packages/mobile/lib/map-filters.ts
// The Map tab's layers and filters. Pure: the screen, the pins and the list
// all read what applyFilters returns.
import type { Ionicons } from '@expo/vector-icons'
import type { MapItem, MapKind, MapPlace } from '@splat-connect/types'
import { theme } from './theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export const KINDS: Record<MapKind, { label: string; one: string; icon: IconName; color: string; soft: string }> = {
  toy: { label: 'Toys', one: 'Toy', icon: 'cube-outline', color: theme.colors.apricot, soft: theme.colors.apricotSoft },
  printer: { label: 'Printers', one: 'Printer', icon: 'print-outline', color: theme.colors.primary, soft: theme.colors.accentLight },
  event: { label: 'Events', one: 'Event', icon: 'calendar-outline', color: theme.colors.violet, soft: theme.colors.violetSoft },
  dropoff: { label: 'Drop-offs', one: 'Drop-off', icon: 'refresh-outline', color: theme.colors.mint, soft: theme.colors.mintSoft },
  org: { label: 'Organisations', one: 'Organisation', icon: 'business-outline', color: theme.colors.honey, soft: theme.colors.honeySoft },
}
export const KIND_ORDER = Object.keys(KINDS) as MapKind[]

/** A place's identity: its point. Two places can share a suburb. */
export const placeKey = (p: MapPlace) => `${p.lat},${p.lng}`
export const itemKey = (i: MapItem) => `${i.kind}:${i.id}`

/**
 * One map point per item, for the clustering source. Items at one address (an
 * organisation and its drop-off, say) or one suburb centre share a point, so
 * they fan out on a small spiral, about 20-60 m, to come apart at street zoom.
 * The spiral is drawing only: it is not where anything is.
 */
export function toFeatures(places: MapPlace[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: places.flatMap((p) =>
      p.items.map((i, n) => {
        const r = p.items.length === 1 ? 0 : 0.0002 * Math.sqrt(n + 0.5)
        const a = n * 2.4 // the golden angle, in radians: no two items line up
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng + (r * Math.cos(a)) / Math.cos((p.lat * Math.PI) / 180), p.lat + r * Math.sin(a)] },
          properties: { place: placeKey(p), item: itemKey(i), kind: i.kind, color: KINDS[i.kind].color },
        }
      })
    ),
  }
}

export const MATERIALS = ['PLA', 'PETG', 'TPU'] as const
export const DISTANCES = [2, 5, 10, 25] as const

export type When = 'any' | 'fortnight' | 'weekend'
export type MapFilters = { within: number | null; materials: string[]; when: When }
export const NO_FILTERS: MapFilters = { within: null, materials: [], when: 'any' }

/** How many filters are on, for the button's badge. Layer chips do not count. */
export const filterCount = (f: MapFilters) => (f.within ? 1 : 0) + f.materials.length + (f.when !== 'any' ? 1 : 0)

const DAY = 86_400_000

function keepItem(item: MapItem, f: MapFilters, now: number): boolean {
  if (f.materials.length && (item.kind === 'printer' || item.kind === 'dropoff')) {
    if (!f.materials.some((m) => item.materials?.includes(m))) return false
  }
  if (f.when !== 'any' && item.kind === 'event' && item.starts_at) {
    const start = new Date(item.starts_at)
    if (f.when === 'fortnight' && start.getTime() - now > 14 * DAY) return false
    if (f.when === 'weekend' && start.getDay() !== 0 && start.getDay() !== 6) return false
  }
  return true
}

/** Places with only the shown kinds and the items the filters keep; empty places drop out. */
export function applyFilters(places: MapPlace[], kinds: Set<MapKind>, f: MapFilters, now = Date.now()): MapPlace[] {
  return places
    .filter((p) => !f.within || (p.km !== null && p.km <= f.within))
    .map((p) => ({ ...p, items: p.items.filter((i) => kinds.has(i.kind) && keepItem(i, f, now)) }))
    .filter((p) => p.items.length > 0)
}

/** Where tapping an item goes. */
export function itemRoute(i: MapItem): string {
  switch (i.kind) {
    case 'toy':
      return `/toy-library/${i.id}`
    case 'printer':
      return '/printing'
    case 'event':
      return `/events/${i.id}`
    case 'dropoff':
      return '/explore/recycling'
    case 'org':
      return `/toy-library/organisation/${i.id}`
  }
}

/** The row's second line: the kind, then the server's meta, or the date for an event. */
export function itemMeta(i: MapItem): string {
  const date = i.starts_at
    ? new Date(i.starts_at).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null
  return [KINDS[i.kind].one, date, i.meta].filter(Boolean).join(' · ')
}
