import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ExchangesPage from '@/app/dashboard/exchanges/page'
import PrintRequestsPage from '@/app/dashboard/print-requests/page'
import { PrintOfferScreen } from '@/app/dashboard/printers/page'
import type { PrinterWithOwner, ToyTransactionSummary } from '@splat-connect/types'
import { summary } from '../fixtures/transactions'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'me', name: 'Sam', email: 'sam@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: () => null,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/components/mark-notifications-read', () => ({
  MarkNotificationsRead: ({ bucket }: { bucket: string }) => <span data-testid="mark-read" data-bucket={bucket} />,
}))
import { apiClient } from '@/lib/api-client'

function serve(transactions: ToyTransactionSummary[], printers: PrinterWithOwner[] = []) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
    (path === '/api/printers/mine' ? printers : transactions) as never
  )
}
const aPrinter = { id: 'pr-1', name: 'Prusa MK4', owner_id: 'me', owner_org_id: null, org_name: null, bed_x: 250, bed_y: 210, bed_z: 220, materials: ['PLA'], accepting: true, capacity: 2, open_jobs: 1, suburb: 'Ashfield', state: 'NSW', filament_cents_per_g: 4 } as unknown as PrinterWithOwner

beforeEach(() => vi.clearAllMocks())

describe('/dashboard/exchanges', () => {
  it('WX01 clears the exchanges bucket, and only that one, when the page opens', async () => {
    serve([summary()])
    render(await ExchangesPage())
    const marks = screen.getAllByTestId('mark-read')
    expect(marks.map((m) => m.getAttribute('data-bucket'))).toEqual(['exchanges'])
  })

  it('WX02 links a gift to its thread and a build to the build thread, and a waiting row to the same place', async () => {
    serve([
      summary({ id: 'gift-1', toy_name: 'Fire truck', status: 'requested', owner_id: 'me', requester_id: 'ash' }),
      summary({ id: 'build-1', type: 'build', toy_id: null, toy_name: '', tutorial_title: 'Bubble machine', status: 'accepted', owner_id: 'maker-1', requester_id: 'me' }),
    ])
    render(await ExchangesPage())
    const rows = screen.getAllByRole('listitem')
    const gift = rows.find((r) => within(r).queryByText('Fire truck'))!
    const build = rows.find((r) => within(r).queryByText('Bubble machine'))!
    expect(within(gift).getByRole('link', { name: 'Thread' })).toHaveAttribute('href', '/dashboard/exchanges/gift-1')
    expect(within(gift).getByRole('link', { name: 'Waiting on you — accept or decline' })).toHaveAttribute('href', '/dashboard/exchanges/gift-1')
    expect(within(build).getByRole('link', { name: 'Thread' })).toHaveAttribute('href', '/dashboard/exchanges/build/build-1')
    expect(screen.getByText('1 waiting on you')).toBeInTheDocument()
  })

  it('WX03 sends an empty list on to the toy library', async () => {
    serve([])
    render(await ExchangesPage())
    expect(screen.getByText('No donation or exchange requests yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse the toy library' })).toHaveAttribute('href', '/toy-library')
  })
})

describe('/dashboard/print-requests', () => {
  const mine = (o: Partial<ToyTransactionSummary> = {}) =>
    summary({ id: 'job-1', type: 'print', toy_id: null, toy_name: '', tutorial_id: 'guide-1', tutorial_title: 'Switch mount', status: 'requested', owner_id: 'printer-1', requester_id: 'me', created_at: new Date().toISOString(), ...o })

  it('WR10 links each request to its print thread, and the guide beside it', async () => {
    serve([mine()])
    render(await PrintRequestsPage())
    expect(screen.getByRole('heading', { name: 'My print requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thread' })).toHaveAttribute('href', '/dashboard/print-requests/job-1')
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/tutorials/guide-1')
  })

  it('WR11 leads the header’s New request, and an empty list, to the printer finder', async () => {
    serve([])
    render(await PrintRequestsPage())
    expect(screen.getByText('No print requests yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/printing')
  })
})

describe('/dashboard/printers', () => {
  const job = (o: Partial<ToyTransactionSummary> = {}) =>
    summary({ id: 'job-7', type: 'print', toy_id: null, toy_name: '', tutorial_title: 'Cradle', status: 'accepted', printer_id: 'pr-1', owner_id: 'me', requester_id: 'ash', other_party_name: 'Ash', ...o })

  it('WR21 offers Add a printer in the header', async () => {
    serve([], [aPrinter])
    render(await PrintOfferScreen({ title: 'Print for others', lead: 'Your printers.' }))
    expect(screen.getByRole('heading', { name: 'Print for others' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a printer' })).toHaveAttribute('href', '/dashboard/printers/new')
  })

  it('WR27 links a job on the bed, and a finished one in History, to its print thread', async () => {
    serve([job(), job({ id: 'job-8', tutorial_title: 'Old job', status: 'completed' })], [aPrinter])
    render(await PrintOfferScreen({ title: 'Print for others', lead: 'Your printers.' }))
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Jobs/ }), { button: 0, ctrlKey: false })
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/dashboard/print-requests/'))
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      expect.arrayContaining(['/dashboard/print-requests/job-7', '/dashboard/print-requests/job-8'])
    )
    expect(screen.getByRole('link', { name: /Start printing/ })).toHaveAttribute('href', '/dashboard/print-requests/job-7')
  })
})
