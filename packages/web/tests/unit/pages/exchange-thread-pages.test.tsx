import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExchangeDetailPage from '@/app/dashboard/exchanges/[id]/page'
import BuildDetailPage from '@/app/dashboard/exchanges/build/[id]/page'
import PrintJobPage from '@/app/dashboard/print-requests/[id]/page'
import type { PickupAddress, ToyTransactionDetail } from '@splat-connect/types'
import { detail } from '../fixtures/transactions'

type ThreadProps = {
  onSendMessage: (body: string) => Promise<void>
  onAccept: (address: PickupAddress | null) => Promise<void>
  onReject: (reason?: string) => Promise<void>
  onWithdraw: () => Promise<void>
  onConfirm: (code: string) => Promise<void>
}
const thread = vi.hoisted(() => ({ props: null as unknown }))
const viewer = vi.hoisted(() => ({ id: 'owner-1' }))
const actions = vi.hoisted(() => ({
  sendMessage: vi.fn(), accept: vi.fn(), reject: vi.fn(), withdraw: vi.fn(), confirm: vi.fn(),
}))

vi.mock('@/components/toy-transaction-thread', () => ({
  ToyTransactionThread: (props: unknown) => {
    thread.props = props
    return null
  },
}))
vi.mock('@/lib/require-capabilities', () => ({
  requireCapabilities: async () => ({
    profile: { id: viewer.id, name: 'Sam', email: 's@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/app/dashboard/exchanges/actions', () => actions)
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT ${to}`) },
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
}))
vi.mock('@/components/live-transaction', () => ({ LiveTransaction: () => null }))
import { apiClient } from '@/lib/api-client'

const props = () => thread.props as ThreadProps
const params = Promise.resolve({ id: 'tx-1' })

function serve(tx: ToyTransactionDetail) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/api/toy-transactions/tx-1') return tx as never
    if (path === '/api/exchange-costs/tx-1') return { lines: [], settlement: null } as never
    return [] as never
  })
  vi.mocked(apiClient.post).mockResolvedValue({} as never)
}

const ADDRESS: PickupAddress = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }


beforeEach(() => {
  vi.clearAllMocks()
  viewer.id = 'owner-1'
  thread.props = null
})

describe('/dashboard/exchanges/[id]', () => {
  beforeEach(() => serve(detail({ status: 'requested' })))
  const mount = async () => render(await ExchangeDetailPage({ params }))

  it('WX05 posts the message body and refreshes this thread', async () => {
    await mount()
    await props().onSendMessage('Is it still free?')
    expect(actions.sendMessage).toHaveBeenCalledWith('tx-1', 'exchange', 'Is it still free?')
  })

  it('WX06 accepts with the address the owner typed, and with an empty body for an organisation', async () => {
    await mount()
    await props().onAccept(ADDRESS)
    expect(actions.accept).toHaveBeenLastCalledWith('tx-1', 'exchange', ADDRESS)
    await props().onAccept(null)
    expect(actions.accept).toHaveBeenLastCalledWith('tx-1', 'exchange', null)
  })

  it('WX07 rejects with the reason the thread hands over', async () => {
    await mount()
    await props().onReject('Bed too small')
    expect(actions.reject).toHaveBeenCalledWith('tx-1', 'exchange', 'Bed too small')
  })

  it('WX08 withdraws the request', async () => {
    await mount()
    await props().onWithdraw()
    expect(actions.withdraw).toHaveBeenCalledWith('tx-1', 'exchange')
  })

  it('WX09 confirms with the code the other party read out', async () => {
    await mount()
    await props().onConfirm('482913')
    expect(actions.confirm).toHaveBeenCalledWith('tx-1', 'exchange', '482913')
  })

  it('WX13 links the header to the toy listing', async () => {
    await mount()
    expect(screen.getByRole('link', { name: /View the listing/ })).toHaveAttribute('href', '/toy-library/toy-1')
  })

  it('WX13 is not found for a transaction the API does not return', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API error: status 404'))
    await expect(ExchangeDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

describe('/dashboard/exchanges/build/[id]', () => {
  const build = (o: Partial<ToyTransactionDetail> = {}) =>
    detail({ type: 'build', toy_id: null, toy_name: '', tutorial_id: 'guide-1', tutorial_title: 'Bubble machine', status: 'requested', ...o })
  const mount = async () => render(await BuildDetailPage({ params }))

  beforeEach(() => serve(build()))

  it('WX15 posts the message body and refreshes the build thread', async () => {
    await mount()
    await props().onSendMessage('Which switch?')
    expect(actions.sendMessage).toHaveBeenCalledWith('tx-1', 'build', 'Which switch?')
  })

  it('WX16 accepts with the maker’s address, or an empty body for an organisation', async () => {
    await mount()
    await props().onAccept(ADDRESS)
    expect(actions.accept).toHaveBeenLastCalledWith('tx-1', 'build', ADDRESS)
    await props().onAccept(null)
    expect(actions.accept).toHaveBeenLastCalledWith('tx-1', 'build', null)
  })

  it('WX17 rejects with the reason the thread hands over', async () => {
    await mount()
    await props().onReject('Too far')
    expect(actions.reject).toHaveBeenCalledWith('tx-1', 'build', 'Too far')
  })

  it('WX18 withdraws the request', async () => {
    await mount()
    await props().onWithdraw()
    expect(actions.withdraw).toHaveBeenCalledWith('tx-1', 'build')
  })

  it('WX19 confirms with the other party’s code', async () => {
    await mount()
    await props().onConfirm('654321')
    expect(actions.confirm).toHaveBeenCalledWith('tx-1', 'build', '654321')
  })

  it('WX22 offers the requester Asking first only while nobody has claimed it', async () => {
    viewer.id = 'requester-1'
    serve(build({ owner_id: null, owner_name: '' }))
    const { unmount } = await mount()
    expect(screen.getByRole('link', { name: 'Asking first' })).toHaveAttribute('href', '/dashboard/exchanges/build/tx-1/ask')
    unmount()

    serve(build({ owner_id: 'owner-1' }))
    await mount()
    expect(screen.queryByRole('link', { name: 'Asking first' })).toBeNull()
  })

  it('WX23 links the header to the guide being built', async () => {
    await mount()
    expect(screen.getByRole('link', { name: /Open the guide/ })).toHaveAttribute('href', '/tutorials/guide-1')
  })

  it('WX23 sends a donation opened at the build URL to its own page', async () => {
    serve(detail({ type: 'donation' }))
    await expect(BuildDetailPage({ params })).rejects.toThrow('REDIRECT /dashboard/exchanges/tx-1')
  })
})

describe('/dashboard/print-requests/[id]', () => {
  const print = (o: Partial<ToyTransactionDetail> = {}) =>
    detail({ type: 'print', toy_id: null, toy_name: '', tutorial_id: 'guide-1', tutorial_title: 'Switch mount', status: 'requested', ...o })
  const mount = async () => render(await PrintJobPage({ params }))

  beforeEach(() => serve(print()))

  it('WR12 posts the message body and refreshes the print thread', async () => {
    await mount()
    await props().onSendMessage('Is PETG fine?')
    expect(actions.sendMessage).toHaveBeenCalledWith('tx-1', 'print', 'Is PETG fine?')
  })

  it('WR13 accepts with the printer’s address', async () => {
    await mount()
    await props().onAccept(ADDRESS)
    expect(actions.accept).toHaveBeenCalledWith('tx-1', 'print', ADDRESS)
  })

  it('WR14 declines with the reason the printer wrote', async () => {
    await mount()
    await props().onReject('Bed is too small for the base plate.')
    expect(actions.reject).toHaveBeenCalledWith('tx-1', 'print', 'Bed is too small for the base plate.')
  })

  it('WR15 withdraws the request', async () => {
    await mount()
    await props().onWithdraw()
    expect(actions.withdraw).toHaveBeenCalledWith('tx-1', 'print')
  })

  it('WR16 confirms with the other party’s code', async () => {
    await mount()
    await props().onConfirm('111222')
    expect(actions.confirm).toHaveBeenCalledWith('tx-1', 'print', '111222')
  })

  it('WR19 leads the printer back to Print for others and the family to All print requests', async () => {
    await mount()
    expect(screen.getByRole('link', { name: /Print for others/ })).toHaveAttribute('href', '/dashboard/printers')
    expect(screen.queryByRole('link', { name: /All print requests/ })).toBeNull()
  })

  it('WR19 leads the family to All print requests', async () => {
    viewer.id = 'requester-1'
    await mount()
    expect(screen.getByRole('link', { name: /All print requests/ })).toHaveAttribute('href', '/dashboard/print-requests')
  })

  it('WR20 links the guide the parts came from', async () => {
    await mount()
    expect(screen.getByRole('link', { name: /From Switch mount/ })).toHaveAttribute('href', '/tutorials/guide-1')
  })

  it('WR20 sends a build opened at the print URL to its own page', async () => {
    serve(detail({ type: 'build' }))
    await expect(PrintJobPage({ params })).rejects.toThrow('REDIRECT /dashboard/exchanges/build/tx-1')
  })
})
