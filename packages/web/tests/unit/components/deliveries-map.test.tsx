import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// jsdom cannot run Leaflet; stand each react-leaflet part in as plain markup so
// the test reads what the map hands Leaflet.
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ attribution }: { attribution: string }) => <div data-testid="tiles">{attribution}</div>,
  CircleMarker: ({ children, radius }: { children: ReactNode; radius: number }) => (
    <div data-testid="circle" data-radius={radius}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => <span data-testid="hover">{children}</span>,
  Popup: ({ children }: { children: ReactNode }) => <span data-testid="tap">{children}</span>,
}))

import DeliveriesMap from '@/components/deliveries-map'

describe('DeliveriesMap', () => {
  it('names each suburb and its count on hover and on tap, sizes by count, and credits OpenStreetMap', () => {
    render(
      <DeliveriesMap
        suburbs={[
          { suburb: 'Newcastle', state: 'NSW', deliveries: 12, lat: -32.93, lng: 151.75 },
          { suburb: 'Wagga Wagga', state: 'NSW', deliveries: 3, lat: -35.11, lng: 147.37 },
        ]}
      />
    )
    expect(screen.getAllByTestId('hover').map((n) => n.textContent)).toEqual([
      'Newcastle, NSW · 12 deliveries',
      'Wagga Wagga, NSW · 3 deliveries',
    ])
    expect(screen.getAllByTestId('tap').map((n) => n.textContent)).toEqual([
      'Newcastle, NSW · 12 deliveries',
      'Wagga Wagga, NSW · 3 deliveries',
    ])
    const [big, small] = screen.getAllByTestId('circle').map((n) => Number(n.dataset.radius))
    expect(big).toBeGreaterThan(small)
    expect(screen.getByTestId('tiles')).toHaveTextContent(/OpenStreetMap.*contributors/)
  })
})
