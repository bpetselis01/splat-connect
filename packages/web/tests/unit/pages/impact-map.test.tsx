import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
// Leaflet needs a real browser; the loader is the seam. It only has to receive the rows.
vi.mock('@/components/deliveries-map-loader', () => ({
  DeliveriesMapLoader: ({ suburbs }: { suburbs: unknown[] }) => <div data-testid="map">{suburbs.length}</div>,
}))

beforeEach(() => vi.clearAllMocks())

describe('/impact/map', () => {
  it('draws the suburbs on the map and lists them, with the rule it keeps', async () => {
    get.mockResolvedValue([
      { suburb: 'Newcastle', state: 'NSW', deliveries: 12, lat: -32.93, lng: 151.75 },
      { suburb: 'Wagga Wagga', state: 'NSW', deliveries: 3, lat: -35.11, lng: 147.37 },
    ])
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(get).toHaveBeenCalledWith('/api/public/impact/map')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Deliveries map')
    expect(screen.getByText('Where adapted toys have actually landed.')).toBeInTheDocument()
    expect(screen.getByText(/never at address level, and never for fewer than three deliveries in a suburb/)).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveTextContent('2')
    expect(screen.getByText('Newcastle, NSW · 12 deliveries')).toBeInTheDocument()
    expect(screen.getByText('Wagga Wagga, NSW · 3 deliveries')).toBeInTheDocument()
  })

  it('says so, and draws no map, when no suburb has three yet', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(screen.getByText('No suburb has three deliveries yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('map')).toBeNull()
  })

  it('says it could not load, rather than claiming there is nothing', async () => {
    get.mockRejectedValue(new Error('500'))
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not load. Try again soon.')
    expect(screen.queryByText('No suburb has three deliveries yet.')).toBeNull()
  })
})
