import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useToast } from '@/components/toast'

const { mockGetCapabilities, mockGet, fetchMock } = vi.hoisted(() => ({
  mockGetCapabilities: vi.fn(),
  mockGet: vi.fn(),
  fetchMock: vi.fn(),
}))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/organizations/o1/public',
}))
vi.mock('@/components/org-actions', () => ({
  OrgActions: ({ me }: { me: unknown }) => {
    const toast = useToast()
    return <button onClick={() => toast('probe')}>ACTIONS {me ? 'member' : 'visitor'}</button>
  },
}))
vi.stubGlobal('fetch', fetchMock)

const profile = (over: object = {}) => ({
  id: 'o1', name: 'Northbank Therapy', status: 'active', about: 'We run a monthly build day for local families.',
  suburb: 'Newtown', state: 'NSW', capabilities: ['Has a printer'], created_at: '2024-03-01T00:00:00Z',
  tutorialsBacked: [], tutorialsApproved: [], toysShared: [], toysDelivered: [],
  recycling_materials: ['PLA', 'PETG'], recycling_door: 'Side door on Smith St', recycling_gives: 'credit',
  events: [{ id: 'ev-1', org_id: 'o1', title: 'Switch build day', summary: null, starts_at: '2026-11-01T01:00:00Z', ends_at: null, format: 'in_person', location: 'Newtown Hall', audience: null, status: 'published' }],
  stories: [], ...over,
})

async function renderPage() {
  const { default: Page } = await import('@/app/organizations/[id]/public/page')
  render(await Page({ params: Promise.resolve({ id: 'o1' }) }))
}

// The first import pulls the icon set in cold, which can outlast the default 5s on a busy machine.
beforeAll(() => import('@/app/organizations/[id]/public/page'), 120_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCapabilities.mockResolvedValue(null)
  mockGet.mockResolvedValue({ leads: false, following: false, thanks: null, conversation_id: null })
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(profile()) })
})

describe('organisation public page', () => {
  it('WN06 reads the public profile for anyone and draws its about, place, capabilities and events', async () => {
    await renderPage()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/public\/organizations\/o1$/), { cache: 'no-store' })
    expect(screen.getByRole('heading', { level: 1, name: 'Northbank Therapy' })).toBeInTheDocument()
    expect(screen.getByText('We run a monthly build day for local families.')).toBeInTheDocument()
    expect(screen.getAllByText('Newtown, NSW').length).toBeGreaterThan(0)
    expect(screen.getByText('On SPLAT since 2024')).toBeInTheDocument()
    expect(screen.getByText('Has a printer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Switch build day/ })).toHaveAttribute('href', '/get-involved/events/ev-1')
    expect(screen.getByText('ACTIONS visitor')).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('WN06 reads the viewer\'s own relationship to the organisation when signed in', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1', name: 'Priya Nair' } })
    await renderPage()
    expect(mockGet).toHaveBeenCalledWith('/api/organizations/o1/me')
    expect(screen.getByText('ACTIONS member')).toBeInTheDocument()
  })

  it('WN07 gives the buttons a ToastProvider, so Follow and Say thanks can confirm', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('ACTIONS visitor'))
    expect(screen.getByRole('status')).toHaveTextContent('probe')
  })

  it('WN06 is a 404 when the organisation is not public', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    const { default: Page } = await import('@/app/organizations/[id]/public/page')
    await expect(Page({ params: Promise.resolve({ id: 'o1' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('WN11 sends a signed-in member from the recycling card to book a drop-off with this organisation chosen', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1', name: 'Priya Nair' } })
    await renderPage()
    expect(screen.getByRole('link', { name: 'Book a drop-off' })).toHaveAttribute('href', '/get-involved/recycling/drop-off?org=o1')
  })

  it('WN11 sends a signed-out visitor from the recycling card to how recycling works', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: 'How recycling works' })).toHaveAttribute('href', '/get-involved/recycling')
    expect(screen.queryByRole('link', { name: 'Book a drop-off' })).toBeNull()
  })
})
