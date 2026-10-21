import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { StoryListItem } from '@splat-connect/types'
import ImpactPage from '@/app/impact/page'
import ImpactMapPage from '@/app/impact/map/page'
import ImpactEventsPage from '@/app/impact/events/page'
import ImpactNewsPage from '@/app/impact/news/page'
import PartnersPage from '@/app/about/partners/page'
import SupportPage from '@/app/about/support/page'
import StoriesPage from '@/app/about/stories/page'
import StoryPage from '@/app/about/stories/[id]/page'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
const caps = vi.fn()
vi.mock('@/lib/capabilities', () => ({ getCapabilities: () => caps() }))
vi.mock('@/components/deliveries-map-loader', () => ({
  DeliveriesMapLoader: ({ suburbs }: { suburbs: unknown[] }) => <div data-testid="map">{suburbs.length} pins</div>,
}))
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<object>()),
  permanentRedirect: (to: string) => {
    throw new Error(`redirect ${to}`)
  },
  notFound: () => {
    throw new Error('not found')
  },
  usePathname: () => '/impact',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const story = (o: Partial<StoryListItem>): StoryListItem => ({
  id: 's1', org_id: 'o1', kind: 'family', title: 'A drum for Mia', summary: 'Mia plays it daily.',
  body: 'First paragraph.\n\nSecond paragraph.', byline: 'Sam, Bayside OT', consent_confirmed: true, photo_urls: [],
  featured: false, pull_quote: null, pull_quote_by: null, link_tutorial_id: null, status: 'published',
  published_at: '2026-09-01T00:00:00Z', created_by: 'u1', created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z', org_name: 'Bayside OT', read_minutes: 3, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  caps.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllGlobals())

describe('Impact', () => {
  const summary = {
    totals: { tutorials: 7, toysShared: 4, toysDelivered: 12, contributors: 1, organisations: 1 },
    recent: [],
    contributors: [{ id: 'c1', name: 'Ada Maker', tutorials: 2, toysShared: 1, toysDelivered: 3 }],
    organisations: [{ id: 'o1', name: 'Bayside OT', tutorials: 0, toysShared: 0, toysDelivered: 5, projectsBacked: 2 }],
    deliveriesByMonth: [{ month: '2026-08', n: 2 }],
  }

  it('WS01 shows the totals, links each card to its profile and the featured story to its page', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => summary }))
    get.mockImplementation(async (path: string) =>
      path === '/api/public/stories' ? [story({ id: 's9', title: 'Featured one', featured: true })] : []
    )
    render(await ImpactPage())
    expect(screen.getByTestId('impact-stat-guides')).toHaveTextContent('7')
    expect(screen.getByTestId('impact-stat-toys-delivered')).toHaveTextContent('12')
    const cards = screen.getAllByTestId('impact-card')
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/contributors/c1', '/organizations/o1/public'])
    expect(cards[0]).toHaveTextContent('Ada Maker')
    expect(cards[0]).toHaveTextContent('2 guides · 3 delivered')
    expect(screen.getByRole('img', { name: 'Bar chart of toys delivered per month, Aug 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Featured one' })).toHaveAttribute('href', '/about/stories/s9')
    expect(screen.getByRole('link', { name: /All stories/ })).toHaveAttribute('href', '/about/stories')
    expect(screen.getByRole('link', { name: /Deliveries map/ })).toHaveAttribute('href', '/impact/map')
    expect(screen.queryByText('SOON')).toBeNull()
  })

  it('WS01 reads as empty, not broken, when the impact summary cannot be fetched', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('down')
    })
    get.mockRejectedValue(new Error('down'))
    render(await ImpactPage())
    expect(screen.getByText('No contributors yet.')).toBeInTheDocument()
    expect(screen.getByTestId('impact-stat-guides')).toHaveTextContent('0')
  })

  it('WS02 lists each suburb with its deliveries beside the map', async () => {
    get.mockResolvedValue([
      { suburb: 'Fitzroy', state: 'VIC', deliveries: 3, lat: -37.8, lng: 144.98 },
      { suburb: 'Newtown', state: 'NSW', deliveries: 5, lat: -33.9, lng: 151.18 },
    ])
    render(await ImpactMapPage())
    expect(get).toHaveBeenCalledWith('/api/public/impact/map')
    expect(screen.getByTestId('map')).toHaveTextContent('2 pins')
    expect(screen.getByText('Fitzroy, VIC · 3 deliveries')).toBeInTheDocument()
    expect(screen.getByText('Newtown, NSW · 5 deliveries')).toBeInTheDocument()
  })

  it('WS02 says so when no suburb has three deliveries, and alerts when the map cannot load', async () => {
    get.mockResolvedValue([])
    render(await ImpactMapPage())
    expect(screen.getByText('No suburb has three deliveries yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('map')).toBeNull()
    get.mockRejectedValue(new Error('down'))
    render(await ImpactMapPage())
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not load. Try again soon.')
  })

  it('WS03 sends /impact/events to /get-involved/events', () => {
    expect(() => ImpactEventsPage()).toThrow('redirect /get-involved/events')
  })

  it('WS04 sends /impact/news to /about/stories', () => {
    expect(() => ImpactNewsPage()).toThrow('redirect /about/stories')
  })
})

describe('About partners and support', () => {
  it('WS07 lists the delivery partners with their place and profile link, and says funders are none yet', async () => {
    get.mockResolvedValue([
      { id: 'o1', name: 'Bayside OT', suburb: 'Brighton', state: 'VIC' },
      { id: 'o2', name: 'Hills School', suburb: null, state: null },
    ])
    render(await PartnersPage())
    expect(get).toHaveBeenCalledWith('/api/public/organizations')
    const bayside = screen.getByRole('link', { name: /Bayside OT/ })
    expect(bayside).toHaveAttribute('href', '/organizations/o1/public')
    expect(bayside).toHaveTextContent('Brighton, VIC')
    expect(screen.getByRole('link', { name: /Hills School/ })).toHaveTextContent('Australia')
    expect(screen.getByRole('link', { name: 'Talk about funding' })).toHaveAttribute('href', '/contact')
    expect(screen.getByRole('link', { name: 'Register an organisation' })).toHaveAttribute(
      'href',
      '/get-involved/organisations'
    )
    const funders = screen.getByRole('heading', { name: 'Funders and grants' }).closest('section')!
    expect(within(funders).getByText(/^None yet\./)).toBeInTheDocument()
  })

  it('WS07 shows the empty-directory copy when there are no organisations', async () => {
    get.mockRejectedValue(new Error('down'))
    render(await PartnersPage())
    expect(screen.getByText(/^No organisations yet\./)).toBeInTheDocument()
  })

  it('WS08 links each way to help to its page, with Contact for funding', () => {
    render(<SupportPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Support SPLAT' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Give your skills/ })).toHaveAttribute('href', '/get-involved/contributors')
    expect(screen.getByRole('link', { name: /Give toys and parts/ })).toHaveAttribute('href', '/organizations')
    expect(screen.getByRole('link', { name: /Register your organisation/ })).toHaveAttribute('href', '/get-involved/organisations')
    expect(screen.getByRole('link', { name: /Send in an idea/ })).toHaveAttribute('href', '/get-involved/submit-an-idea')
    expect(screen.getByRole('link', { name: 'See how build days run' })).toHaveAttribute('href', '/get-involved/events')
    expect(screen.getByRole('link', { name: 'Talk to us about funding' })).toHaveAttribute('href', '/contact')
  })
})

describe('Stories', () => {
  const all = [
    story({ id: 'f1', title: 'The featured one', featured: true }),
    story({ id: 'm1', kind: 'maker', title: 'A maker night' }),
    story({ id: 'm2', kind: 'maker', title: 'Another maker night' }),
    story({ id: 'o9', kind: 'org_update', title: 'Org news' }),
  ]

  it('WS09 draws the featured story once and counts the rest per kind', async () => {
    get.mockResolvedValue(all)
    render(await StoriesPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Open The featured one' })).toHaveAttribute('href', '/about/stories/f1')
    expect(screen.getAllByText('The featured one')).toHaveLength(1)
    const filters = within(screen.getByRole('group', { name: 'Story type' }))
    expect(filters.getByRole('link', { name: /^All 3$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(filters.getByRole('link', { name: /Maker stories 2/ })).toHaveAttribute('href', '/about/stories?kind=maker')
    expect(filters.getByRole('link', { name: /Family stories 0/ })).toHaveAttribute('href', '/about/stories?kind=family')
  })

  it('WS09 narrows to one kind and offers a member who leads no organisation the register link', async () => {
    get.mockResolvedValue(all)
    render(await StoriesPage({ searchParams: Promise.resolve({ kind: 'maker' }) }))
    expect(screen.getByRole('heading', { name: 'A maker night' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Another maker night' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Org news' })).toBeNull()
    expect(screen.getByRole('link', { name: /Maker stories 2/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Register your organisation' })).toHaveAttribute('href', '/get-involved/organisations')
    expect(screen.queryByRole('link', { name: 'Write a story' })).toBeNull()
  })

  it('WS09 shows an organisation leader the Write a story link, and the empty copy under an empty filter', async () => {
    get.mockResolvedValue(all)
    caps.mockResolvedValue({ ledOrgs: [{ id: 'o1' }] })
    render(await StoriesPage({ searchParams: Promise.resolve({ kind: 'family' }) }))
    expect(screen.getAllByRole('link', { name: 'Write a story' })[0]).toHaveAttribute('href', '/dashboard/organisation/publish')
    expect(screen.getByText('Nothing under that filter yet. Try All.')).toBeInTheDocument()
  })

  const detail = (o: object = {}) => ({
    ...story({ id: 'd1', title: 'Drum day', pull_quote: 'It was loud and lovely', pull_quote_by: 'Mia' }),
    org: { id: 'o1', name: 'Bayside OT' },
    link_tutorial: { id: 't1', title: 'Light-up drum' },
    more: [{ id: 'x2', kind: 'maker', title: 'Next story', byline: 'Jo', published_at: null }],
    ...o,
  })

  it('WS10 reads the story with its byline, pull quote, linked guide and more stories', async () => {
    get.mockResolvedValue(detail())
    render(await StoryPage({ params: Promise.resolve({ id: 'd1' }) }))
    expect(get).toHaveBeenCalledWith('/api/public/stories/d1')
    expect(screen.getByRole('heading', { level: 1, name: 'Drum day' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sam, Bayside OT/ })).toHaveAttribute('href', '/organizations/o1/public')
    expect(screen.getByText('First paragraph.')).toBeInTheDocument()
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument()
    expect(screen.getByText(/It was loud and lovely/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read the guide: Light-up drum' })).toHaveAttribute('href', '/tutorials/t1')
    expect(screen.getByRole('link', { name: /Next story/ })).toHaveAttribute('href', '/about/stories/x2')
  })

  it('WS10 gives a story with no organisation no profile link, and an unknown id is not found', async () => {
    get.mockResolvedValue(detail({ org: null, link_tutorial: null, more: [], kind: 'announcement', org_id: null }))
    render(await StoryPage({ params: Promise.resolve({ id: 'd1' }) }))
    expect(screen.queryByRole('link', { name: /Sam, Bayside OT/ })).toBeNull()
    expect(screen.queryByText('More stories')).toBeNull()
    get.mockRejectedValue(new Error('404'))
    await expect(StoryPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('not found')
  })
})
