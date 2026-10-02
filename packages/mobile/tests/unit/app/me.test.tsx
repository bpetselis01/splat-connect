import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import MeTab from '../../../app/(tabs)/me'

// `mock`-prefixed: jest hoists the factory above this const, and only that prefix is allowed through.
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: {
    profile: { name: 'Byron P', role: 'contributor' }, isAdmin: false, ledOrgs: [{ id: 'o', name: 'Alpha' }],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 5 }, exchangeActions: 3,
  }, loading: false, refresh: jest.fn() }),
}))

const thread = (over: object = {}) => ({
  transaction_id: 'tx-a', type: 'exchange', other_name: 'Northside Therapy Collective', what: 'Postage on the handover',
  amount_cents: 1060, you_pay: true, settled: false, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(p === '/api/me/builds' ? { builds: 3 } : { threads: [], owed_cents: 0, unsettled_count: 0 })
  )
})

it('renders every buildNav group as rows, routes them through the map, and ends with Explore', () => {
  render(<MeTab />)
  // getAllByText: "Account" is both a group heading and a row label.
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Organisation', 'Account', 'Explore']) expect(screen.getAllByText(h).length).toBeGreaterThan(0)
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('My toys'))
  expect(mockPush).toHaveBeenCalledWith('/toys')
  fireEvent.press(screen.getByLabelText('Learn'))
  expect(mockPush).toHaveBeenCalledWith('/explore/learn')
  // Explore's own screen has no tab, so this row is its way in.
  fireEvent.press(screen.getByLabelText('Everything in Explore'))
  expect(mockPush).toHaveBeenCalledWith('/explore')
})

it('shows the builds you have logged', async () => {
  render(<MeTab />)
  expect(await screen.findByText('3 builds logged')).toBeTruthy()
})

it("greets by first name and says what a leader leads and how much is waiting", () => {
  render(<MeTab />)
  expect(screen.getByText('Hi, Byron')).toBeTruthy()
  expect(screen.getByText('Leads Alpha · 3 waiting')).toBeTruthy()
})

it('sends every row to its own screen, so none is drawn as SOON', () => {
  render(<MeTab />)
  mockPush.mockClear()
  // My events was the SOON example until it got its screen; now no hub row
  // falls back, and my-routes.test fails the day one does.
  fireEvent.press(screen.getByLabelText('My events'))
  expect(mockPush).toHaveBeenCalledWith('/events')
  fireEvent.press(screen.getByLabelText('Print for others'))
  expect(mockPush).toHaveBeenCalledWith('/print-for-others')
  expect(screen.queryAllByText('SOON')).toHaveLength(0)
})

describe('Money you have agreed to', () => {
  it('names what each thread is for and who it is with, and opens it', async () => {
    mockGet.mockResolvedValue({
      threads: [
        thread({ transaction_id: 'tx-p', type: 'print', other_name: 'Contributor 2', what: 'Filament for your switch mount', amount_cents: 500 }),
        thread({ transaction_id: 'tx-b', type: 'build', other_name: 'Tom Beattie', what: 'Parts for the bubble machine', amount_cents: 890, settled: true }),
        thread(),
        thread({ transaction_id: 'tx-d', what: 'A fourth thread' }),
      ],
      owed_cents: 1560,
      unsettled_count: 2,
    })
    render(<MeTab />)
    expect(await screen.findByText('$15.60')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/exchange-costs/mine')
    expect(screen.getByText(/Still to settle across 2 exchanges\./)).toBeTruthy()
    expect(screen.getByText('Contributor 2 — print job')).toBeTruthy()
    expect(screen.getByText('Tom Beattie — build thread')).toBeTruthy()
    expect(screen.getByText('Northside Therapy Collective')).toBeTruthy()
    expect(screen.getByText('Settled')).toBeTruthy()
    expect(screen.getAllByText('To settle')).toHaveLength(2)
    expect(screen.queryByText('A fourth thread')).toBeNull()
    fireEvent.press(screen.getByText('Parts for the bubble machine'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/tx-b')
  })

  it('says "exchange" for one, not "exchanges"', async () => {
    mockGet.mockResolvedValue({ threads: [thread()], owed_cents: 1060, unsettled_count: 1 })
    render(<MeTab />)
    expect(await screen.findByText(/Still to settle across 1 exchange\./)).toBeTruthy()
  })

  it('says all settled once nothing is left', async () => {
    mockGet.mockResolvedValue({ threads: [thread({ settled: true })], owed_cents: 0, unsettled_count: 0 })
    render(<MeTab />)
    expect(await screen.findByText('All settled — nothing outstanding.')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
  })

  it('draws nothing when there is no money, or when the fetch fails', async () => {
    const { unmount } = render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    unmount()

    mockGet.mockRejectedValue(new Error('down'))
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    expect(screen.getByLabelText('My toys')).toBeTruthy()
  })
})

it('opens Makers wanted from Give us a challenge, and Recycling from Explore', () => {
  render(<MeTab />)
  mockPush.mockClear()
  fireEvent.press(screen.getByLabelText('Makers wanted'))
  expect(mockPush).toHaveBeenCalledWith('/explore/makers-wanted')
  fireEvent.press(screen.getByLabelText('Recycling'))
  expect(mockPush).toHaveBeenCalledWith('/explore/recycling')
  expect(screen.queryByLabelText('Recycle plastic')).toBeNull()
})
