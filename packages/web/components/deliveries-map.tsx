'use client'
/**
 * The deliveries map (impact-map): one circle per suburb on OpenStreetMap,
 * sized by its deliveries. Leaflet touches `window` on import, so this is only
 * ever loaded through deliveries-map-loader.tsx with ssr: false.
 *
 * The rows are impact_map()'s (121) — suburbs with three or more, at postcode
 * centres. Nothing here can make a point finer than that.
 *
 * Hover shows the label as a Tooltip; a tap (touch has no hover) opens the
 * same label as a Popup, which a tap on the map closes (Byron's B4).
 */
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet'
import type { ImpactMapSuburb } from '@splat-connect/types'

// `isolate` keeps Leaflet's own z-indexes (panes 400, controls 1000) inside
// the map, so they never paint over the sticky site header (z-40).

// SVG presentation attributes cannot read a CSS variable, so the brand colour
// is resolved once, here, from the theme.
const brand = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--color-brand-dark').trim() || '#1179b0'

const suburbLine = (s: ImpactMapSuburb) => `${s.suburb}, ${s.state} · ${s.deliveries} deliveries`

export default function DeliveriesMap({ suburbs }: { suburbs: ImpactMapSuburb[] }) {
  const color = brand()
  return (
    <MapContainer
      center={[-27, 134]}
      zoom={4}
      scrollWheelZoom={false}
      className="isolate h-[480px] w-full overflow-hidden rounded-card border border-line max-sm:h-[360px]"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {suburbs.map((s) => (
        <CircleMarker
          key={`${s.suburb}|${s.state}`}
          center={[s.lat, s.lng]}
          radius={6 + 3 * Math.sqrt(s.deliveries)}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
        >
          <Tooltip>{suburbLine(s)}</Tooltip>
          <Popup>{suburbLine(s)}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
