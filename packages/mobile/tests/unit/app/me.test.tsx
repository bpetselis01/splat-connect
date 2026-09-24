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

const line = (id: string, description: string, amount_cents: number, toy: string | null = 'Bubble machine') => ({
  id, transaction_id: `tx-${id}`, description, amount_cents,
  toy_transactions: { id: `tx-${id}`, type: 'exchange', toys: toy ? { name: toy } : null },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ lines: [], total_cents: 0, exchange_count: 0 })
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
  it('shows the total, the exchange count and at most three lines, each opening its exchange', async () => {
    mockGet.mockResolvedValue({
      lines: [
        line('a', 'Filament for your switch mount', 500),
        line('b', 'Parts for the bubble machine', 890),
        line('c', 'Postage on the handover', 1060, null),
        line('d', 'A fourth cost', 100),
      ],
      total_cents: 2550,
      exchange_count: 3,
    })
    render(<MeTab />)
    expect(await screen.findByText('$25.50')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/exchange-costs/outstanding')
    expect(screen.getByText(/Still to settle across 3 exchanges\./)).toBeTruthy()
    expect(screen.getAllByText('TO SETTLE')).toHaveLength(3)
    expect(screen.queryByText('A fourth cost')).toBeNull()
    // A line with no toy still says what it belongs to.
    expect(screen.getByText('This exchange')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Parts for the bubble machine, $8.90 to settle'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx-b')
  })

  it('says "exchange" for one, not "exchanges"', async () => {
    mockGet.mockResolvedValue({ lines: [line('a', 'Postage', 300)], total_cents: 300, exchange_count: 1 })
    render(<MeTab />)
    expect(await screen.findByText(/Still to settle across 1 exchange\./)).toBeTruthy()
  })

  it('draws nothing when nothing is owed, or when the fetch fails', async () => {
    const { unmount } = render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    unmount()

    mockGet.mockRejectedValue(new Error('down'))
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    // The rest of the tab is still there.
    expect(screen.getByLabelText('My toys')).toBeTruthy()
  })
})
