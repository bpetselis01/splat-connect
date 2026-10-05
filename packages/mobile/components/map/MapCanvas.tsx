// packages/mobile/components/map/MapCanvas.tsx
//
// The only file that knows which map library draws the Map tab. MapLibre with
// OpenFreeMap tiles: free, no key, no request cap. Moving to Google means
// rewriting this file with react-native-maps against the same props.
//
// Pins are MapLibre's own clustering: a number is a cluster, and tapping it
// zooms to where it splits; at full zoom every item is its own coloured dot.
import { useMemo, useRef, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { Map, Camera, GeoJSONSource, Images, Layer, type CameraRef, type GeoJSONSourceRef, type LngLatBounds } from '@maplibre/maplibre-react-native'
import type { MapPlace } from '@splat-connect/types'
import { KINDS, KIND_ORDER, toFeatures } from '../../lib/map-filters'
import { theme } from '../../lib/theme'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
// Sydney, for a first frame with nothing to frame.
const SYDNEY: LngLatBounds = [150.9, -34.0, 151.35, -33.7]
const HAS_COUNT = ['has', 'point_count'] as const
// White pin icons, rendered from the app's Ionicons by scripts/map-icons.py.
const ICONS = {
  toy: require('../../assets/map/toy.png'),
  printer: require('../../assets/map/printer.png'),
  event: require('../../assets/map/event.png'),
  dropoff: require('../../assets/map/dropoff.png'),
  org: require('../../assets/map/org.png'),
}
// Each cluster counts its items per kind, so one that is all one kind wears
// that kind's colour and a mixed one is ink, as the mockup's pins do.
// The full reduce form: iOS rejects web MapLibre's bare '+' shorthand.
const PER_KIND = Object.fromEntries(
  KIND_ORDER.map((k) => [k, [['+', ['accumulated'], ['get', k]], ['case', ['==', ['get', 'kind'], k], 1, 0]]])
)
const CLUSTER_COLOR = [
  'case',
  ...KIND_ORDER.flatMap((k) => [['==', ['get', k], ['get', 'point_count']], KINDS[k].color]),
  theme.colors.ink,
]

export type MapCanvasProps = {
  places: MapPlace[]
  /** The tapped item's key (kind:id), drawn larger. */
  selected: string | null
  /** A dot was tapped (its place and item keys), or the map itself (null). */
  onSelect: (place: string | null, item?: string) => void
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
  const camera = useRef<CameraRef>(null)
  const source = useRef<GeoJSONSourceRef>(null)
  const data = useMemo(() => toFeatures(places), [places])
  // Pins mount once the style has loaded, so the icon images are registered
  // before any symbol asks for one; earlier, a pin could draw with no icon.
  const [styleReady, setStyleReady] = useState(false)

  return (
    <>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE}
        logo={false}
        compass={false}
        attribution={false}
        onPress={() => onSelect(null)}
        onDidFinishLoadingStyle={() => setStyleReady(true)}
      >
        <Camera
          ref={camera}
          initialViewState={{ bounds: bounds(places), padding: { top: inset.top + 32, bottom: inset.bottom + 32, left: 40, right: 40 } }}
        />
        {styleReady ? (
          <>
            <Images images={ICONS} />
            <GeoJSONSource
              ref={source}
              id="places"
              data={data}
              cluster
              clusterRadius={44}
              clusterMaxZoom={17}
              clusterProperties={PER_KIND as never}
              onPress={async (e) => {
                e.stopPropagation()
                const f = e.nativeEvent.features[0]
                if (!f || f.geometry.type !== 'Point') return
                const props = f.properties ?? {}
                if (props.cluster) {
                  const zoom = await source.current?.getClusterExpansionZoom(props.cluster_id)
                  if (zoom !== undefined) camera.current?.easeTo({ center: f.geometry.coordinates as [number, number], zoom, duration: 500 })
                } else {
                  onSelect(props.place, props.item)
                }
              }}
            >
              <Layer
                type="circle"
                id="clusters"
                filter={HAS_COUNT as never}
                paint={{
                  'circle-color': CLUSTER_COLOR as never,
                  'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 50, 26],
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': theme.colors.surface,
                }}
              />
              <Layer
                type="symbol"
                id="cluster-count"
                filter={HAS_COUNT as never}
                layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': true }}
                paint={{ 'text-color': theme.colors.surface }}
              />
              <Layer
                type="circle"
                id="items"
                filter={['!', HAS_COUNT] as never}
                paint={{
                  'circle-color': ['get', 'color'],
                  'circle-radius': ['case', ['==', ['get', 'item'], selected ?? ''], 19, 15],
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': theme.colors.surface,
                }}
              />
              <Layer
                type="symbol"
                id="item-icons"
                filter={['!', HAS_COUNT] as never}
                layout={{ 'icon-image': ['get', 'kind'], 'icon-size': 1, 'icon-allow-overlap': true, 'icon-ignore-placement': true }}
              />
            </GeoJSONSource>
          </>
        ) : null}
      </Map>
      {/* The tiles' licence asks for this credit to stay visible; it replaces MapLibre's (i) button. */}
      <Text style={[styles.credit, { bottom: inset.bottom + 8 }]}>© OpenFreeMap © OpenStreetMap</Text>
    </>
  )
}

const styles = StyleSheet.create({
  credit: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)',
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.micro,
    color: theme.colors.muted,
  },
})
