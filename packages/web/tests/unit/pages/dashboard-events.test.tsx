import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyEventsPage from '@/app/dashboard/events/page'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor', created_at: '', public_showcase: true },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { delete: vi.fn() } }))

import { apiClient } from '@/lib/api-client'

const DAY = 86_400_000
const row = (id: string, over: Record<string, unknown> = {}, event: Record<string, unknown> = {}, part_request: unknown = null) => ({
  registration_id: `reg-${id}`,
  registered_at: '2026-10-01T00:00:00Z',
  event: {
    id,
    org_id: 'o1',
    org_name: 'Northbank',
    kind: 'build_day',
    title: `Event ${id}`,
    starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
    ends_at: null,
    format: 'in_person',
    location: '1 Test St',
    suburb: 'Testville',
    state: 'NSW',
    cancelled_at: null,
    prints_parts: false,
    ...event,
  },
  part_request,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('MyEventsPage', () => {
  it('WD27 says "Nothing booked yet" when the Member is registered for nothing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await MyEventsPage())
    expect(apiClient.get).toHaveBeenCalledWith('/api/events/mine')
    expect(screen.getByText('Nothing booked yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All events' })).toHaveAttribute('href', '/get-involved/events')
  })

  it('WD27 links each event title to its public page and offers Can’t make it only on an upcoming, live one', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      row('up'),
      row('gone', {}, { title: 'Old day', starts_at: new Date(Date.now() - 20 * DAY).toISOString() }),
      row('off', {}, { title: 'Called off', cancelled_at: '2026-10-02T00:00:00Z' }),
    ])
    render(await MyEventsPage())
    expect(screen.getByRole('link', { name: 'Event up' })).toHaveAttribute('href', '/get-involved/events/up')
    expect(screen.getByRole('heading', { name: 'Been and gone' })).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Can.t make it/ })).toHaveLength(1)
  })

  it('WD27 says where each part-print request with the host is up to', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      row('a', {}, {}, { id: 'p1', status: 'accepted', part_sets: 2, decline_reason: null }),
      row('b', {}, {}, { id: 'p2', status: 'requested', part_sets: 1, decline_reason: null }),
      row('c', {}, {}, { id: 'p3', status: 'rejected', part_sets: 1, decline_reason: 'No spare printers' }),
    ])
    render(await MyEventsPage())
    expect(screen.getByText('Northbank is printing your parts')).toBeInTheDocument()
    expect(screen.getByText('Northbank has your part list — waiting for them to confirm')).toBeInTheDocument()
    expect(screen.getByText(/Northbank cannot print your parts — No spare printers/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pick a printer/ })).toHaveAttribute('href', '/printing')
  })
})
