// packages/mobile/components/map/MapCanvas.tsx
//
// The only file that knows which map library draws the Map tab. MapLibre with
// OpenFreeMap tiles: free, no key, no request cap. Moving to Google means
// rewriting this file with react-native-maps against the same props.
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Map, Camera, Marker, type LngLatBounds } from '@maplibre/maplibre-react-native'
import type { MapPlace } from '@splat-connect/types'
import { KINDS, placeKey } from '../../lib/map-filters'
import { theme } from '../../lib/theme'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
// Sydney, for a first frame with nothing to frame.
const SYDNEY: LngLatBounds = [150.9, -34.0, 151.35, -33.7]

export type MapCanvasProps = {
  places: MapPlace[]
  selected: string | null
  onSelect: (key: string | null) => void
  /** Space the overlays cover, so framed pins are not hidden under them. */
  inset: { top: number; bottom: number }
}

function bounds(places: MapPlace[]): LngLatBounds {
  if (!places.length) return SYDNEY
  const lngs = places.map((p) => p.lng)
  const lats = places.map((p) => p.lat)
  // A single place still needs a box to zoom to.
  const pad = places.length === 1 ? 0.03 : 0
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad]
}

export function MapCanvas({ places, selected, onSelect, inset }: MapCanvasProps) {
  return (
    <Map style={StyleSheet.absoluteFill} mapStyle={STYLE} logo={false} compass={false} onPress={() => onSelect(null)}>
      <Camera
        initialViewState={{ bounds: bounds(places), padding: { top: inset.top + 24, bottom: inset.bottom + 24, left: 40, right: 40 } }}
      />
      {places.map((p) => {
        const key = placeKey(p)
        const kinds = new Set(p.items.map((i) => i.kind))
        const one = kinds.size === 1 ? KINDS[p.items[0].kind] : null
        const on = key === selected
        return (
          <Marker
            key={key}
            lngLat={[p.lng, p.lat]}
            anchor="bottom"
            onPress={() => onSelect(on ? null : key)}
          >
            <View
              style={styles.pin}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${p.suburb}, ${p.items.length} ${p.items.length === 1 ? 'place' : 'places'}`}
            >
              <View style={[styles.bubble, { backgroundColor: one?.color ?? theme.colors.ink }, on && styles.on]}>
                {one && p.items.length === 1 ? (
                  <Ionicons name={one.icon} size={15} color={theme.colors.surface} />
                ) : (
                  <Text style={styles.count}>{p.items.length}</Text>
                )}
              </View>
              <View style={styles.stem} />
            </View>
          </Marker>
        )
      })}
    </Map>
  )
}

const styles = StyleSheet.create({
  pin: { alignItems: 'center' },
  bubble: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: theme.radii.pill,
    borderWidth: 2.5,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(2),
  },
  on: { transform: [{ scale: 1.18 }] },
  count: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.surface },
  stem: { width: 2.5, height: 7, backgroundColor: theme.colors.surface },
})
