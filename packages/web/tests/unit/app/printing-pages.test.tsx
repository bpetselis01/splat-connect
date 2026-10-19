import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintingPage from '@/app/printing/page'
import PrintingBasics from '@/app/printing/basics/page'
import RequestAPrintPage from '@/app/printing/requests/page'

const caps = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => caps.current }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/printing',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))
import { apiClient } from '@/lib/api-client'

const member = { profile: { id: 'me', name: 'Sam', pickup_postcode: null, pickup_suburb: null, pickup_state: null }, ledOrgs: [] }
const printer = (id: string, name: string) => ({ id, name, owner_id: `owner-${id}`, owner_org_id: null, owner_name: `Owner of ${name}`, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, accepting: true, capacity: 2, open_jobs: 0, suburb: 'Ashfield', state: 'NSW', verified: false, filament_cents_per_g: 4 })

beforeEach(() => {
  vi.clearAllMocks()
  caps.current = null
  vi.mocked(apiClient.get).mockResolvedValue([] as never)
})

describe('/printing', () => {
  it('WR01 points the hero at the printer grid and at recycling for credit', async () => {
    render(await PrintingPage())
    expect(screen.getByRole('heading', { level: 1, name: 'You do not need a printer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Find a printer/ })).toHaveAttribute('href', '#printer-grid')
    expect(screen.getByRole('link', { name: /Recycle plastic for credit/ })).toHaveAttribute('href', '/get-involved/recycling')
  })

  it('WR02 offers a printer owner Add a printer', async () => {
    caps.current = member
    render(await PrintingPage())
    expect(screen.getAllByRole('link', { name: /Add a printer/ })[0]).toHaveAttribute('href', '/dashboard/printers/new')
  })

  it('WR04 locks the directory for a guest and offers sign in and sign up', async () => {
    render(await PrintingPage())
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(screen.getByText('Sign in to ask for a print')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to continue' })).toHaveAttribute('href', '/login?next=%2Fprinting')
    expect(screen.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/signup')
  })

  it('WR03 lists other people’s printers to a member and leaves their own off', async () => {
    caps.current = member
    vi.mocked(apiClient.get).mockResolvedValue([printer('1', 'Prusa MK4'), { ...printer('2', 'My Ender'), owner_id: 'me' }] as never)
    render(await PrintingPage())
    expect(apiClient.get).toHaveBeenCalledWith('/api/printers')
    expect(screen.getByText('Owner of Prusa MK4')).toBeInTheDocument()
    expect(screen.queryByText('Owner of My Ender')).toBeNull()
  })
})

describe('/printing/basics', () => {
  it('WR05 explains printing for switch parts', () => {
    render(<PrintingBasics />)
    expect(screen.getByRole('heading', { level: 1, name: 'Printing basics' })).toBeInTheDocument()
    expect(screen.getByText(/Hand this page to whoever owns the printer/)).toBeInTheDocument()
  })
})

describe('/printing/requests', () => {
  const page = async (guide?: string) => render(await RequestAPrintPage({ searchParams: Promise.resolve({ guide }) }))

  it('WR08 tells a guest to create an account first', async () => {
    await page()
    expect(screen.getByRole('heading', { name: 'Request a print' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  })

  it('WR08 sends a member who has not picked a guide to the library, and back to who is printing', async () => {
    caps.current = member
    await page()
    expect(screen.getByText('Every request starts from a guide')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Find a guide first/ })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /See who is printing/ })).toHaveAttribute('href', '/printing')
  })
})
