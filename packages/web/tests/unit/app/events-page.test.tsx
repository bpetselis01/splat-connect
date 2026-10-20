import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import EventsPage from '@/app/get-involved/events/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const event = (over: object = {}) => ({
  id: 'ev-1', title: 'Switch build day', kind: 'build_day', format: 'in_person', starts_at: future(10), ends_at: future(10),
  suburb: 'Fitzroy', state: 'VIC', location: null, photo_urls: [], cost_cents: null, org_name: 'Northside Makers',
  going_count: 0, seats_left: null, viewer_going: false, has_questions: false, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCapabilities.mockResolvedValue(null)
  mockGet.mockResolvedValue([event()])
})

describe('events list', () => {
  it('WI29 asks the API for the chosen format and state and links the other filters from them', async () => {
    mockGet.mockResolvedValue([event({ format: 'online', title: 'Online switch night' })])
    render(await EventsPage({ searchParams: Promise.resolve({ format: 'online', state: 'NSW' }) }))
    expect(mockGet).toHaveBeenCalledWith('/api/public/events?format=online&state=NSW')
    expect(screen.getByText('Online switch night')).toBeInTheDocument()

    const format = within(screen.getByRole('navigation', { name: 'Format' }))
    expect(format.getByRole('link', { name: /in person/i })).toHaveAttribute('href', '/get-involved/events?format=in_person&state=NSW')
    expect(format.getByRole('link', { name: /online/i })).toHaveAttribute('aria-current', 'page')
    const states = within(screen.getByRole('group', { name: 'State' }))
    expect(states.getByRole('link', { name: 'VIC' })).toHaveAttribute('href', '/get-involved/events?format=online&state=VIC')
    expect(states.getByRole('link', { name: 'Anywhere' })).toHaveAttribute('href', '/get-involved/events?format=online')
  })

  it('WI29 says nothing is coming up for a filter with no events', async () => {
    mockGet.mockResolvedValue([])
    render(await EventsPage({ searchParams: Promise.resolve({ state: 'TAS' }) }))
    expect(screen.getByText('Nothing coming up here yet')).toBeInTheDocument()
    expect(screen.getByText(/Try another state, or switch to online sessions/)).toBeInTheDocument()
  })

  it('WI30 opens an event from its card title', async () => {
    render(await EventsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Switch build day' })).toHaveAttribute('href', '/get-involved/events/ev-1')
  })

  it('WI30 sends a non-leader who wants to host to the organisation request', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' }, ledOrgs: [] })
    render(await EventsPage({ searchParams: Promise.resolve({}) }))
    expect(mockGet).toHaveBeenCalledWith('/api/public/events?viewer=u1')
    expect(screen.getByRole('link', { name: /register your organisation/i })).toHaveAttribute('href', '/get-involved/organisations/request')
  })

  it('WI30 sends a leader to the new-event form', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' }, ledOrgs: [{ id: 'o1' }] })
    render(await EventsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getAllByRole('link', { name: /host an event/i })[0]).toHaveAttribute('href', '/dashboard/organisation/events/new')
  })
})
