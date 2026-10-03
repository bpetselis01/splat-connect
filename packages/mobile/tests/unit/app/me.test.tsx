import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { theme } from '../../../lib/theme'
import { ScrollView, FlatList, StyleSheet } from 'react-native'
import { tabBarClearance } from '../../../lib/tab-bar-layout'
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
    Promise.resolve(
      p === '/api/me/builds'
        ? { builds: 3 }
        : p === '/api/me/counts'
          ? { tutorials: 0, challenges: 0, makers: 7, printRequests: 0, printJobs: 0, review: 6, intake: 0, orgOrders: 0 }
          : { threads: [], owed_cents: 0, unsettled_count: 0 }
    )
  )
})

it('renders every buildNav group as rows, routes them through the map, and no longer links to the Explore index', () => {
  render(<MeTab />)
  // getAllByText: "Account" is both a group heading and a row label.
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Organisation', 'Account', 'Explore']) expect(screen.getAllByText(h).length).toBeGreaterThan(0)
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('My toys'))
  expect(mockPush).toHaveBeenCalledWith('/toys')
  fireEvent.press(screen.getByLabelText('Learn'))
  expect(mockPush).toHaveBeenCalledWith('/explore/learn')
  // Explore's index is no longer reachable from Me: Home carries its list.
  expect(screen.queryByLabelText('Everything in Explore')).toBeNull()
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

it('badges the rows from one counts call', async () => {
  render(<MeTab />)
  expect(await screen.findByText('7')).toBeTruthy()
  expect(screen.getByText('6')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/me/counts')
})

// Review Focus 4: a failed counts call costs the badges, never the tab.
it('renders every row uncounted when the counts call fails', async () => {
  mockGet.mockImplementation((p: string) =>
    p === '/api/me/counts' ? Promise.reject(new Error('500')) : Promise.resolve({ threads: [], owed_cents: 0, unsettled_count: 0 })
  )
  render(<MeTab />)
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/me/counts'))
  expect(screen.getByLabelText('Makers wanted')).toBeTruthy()
  expect(screen.getByLabelText('Review queue')).toBeTruthy()
  expect(screen.queryByText('7')).toBeNull()
  expect(screen.queryByText('6')).toBeNull()
})

it('explains each badge and its threshold from one row', () => {
  render(<MeTab />)
  expect(screen.queryByText('Have 10 approved guides published.')).toBeNull()
  fireEvent.press(screen.getByLabelText('How badges are earned'))
  expect(screen.getByText('Have 10 approved guides published.')).toBeTruthy()
  expect(screen.getByText('Families log 100 builds from your published guides.')).toBeTruthy()
})

// The row is an inline panel, not a screen: closed it drew nothing to say so,
// and opened below the fold it looked like a tap that did nothing.
it('says its panel is open or closed, and scrolls the panel into view when it opens', () => {
  render(<MeTab />)
  const scroller = screen.UNSAFE_getByType(ScrollView)
  const scrollTo = jest.spyOn(scroller.instance, 'scrollTo')
  const row = () => screen.getByLabelText('How badges are earned')
  expect(row().props.accessibilityState).toMatchObject({ expanded: false })
  fireEvent.press(row())
  expect(row().props.accessibilityState).toMatchObject({ expanded: true })
  expect(scrollTo).toHaveBeenCalledTimes(1)
  fireEvent.press(row())
  expect(row().props.accessibilityState).toMatchObject({ expanded: false })
  expect(scrollTo).toHaveBeenCalledTimes(1)
})

const clears = (nodes: { props: { contentContainerStyle?: unknown } }[]) =>
  nodes.some((n) => (StyleSheet.flatten(n.props.contentContainerStyle as object) as { paddingBottom?: number } | undefined)?.paddingBottom === tabBarClearance(0))

it('pads its scroll content so the last row clears the floating tab bar', () => {
  render(<MeTab />)
  expect(clears(screen.UNSAFE_getAllByType(ScrollView))).toBe(true)
})

// The page ground is the background token, and the scroll frame spans the
// Screen padding so it cannot clip the cards' shadows into a grey rectangle.
const groundOk = (root: any, frame: { props: { style?: unknown; contentContainerStyle?: unknown } }) => {
  const ground = StyleSheet.flatten(root.props.style) as { backgroundColor?: string }
  const f = StyleSheet.flatten(frame.props.style as object) as { marginHorizontal?: number }
  const c = StyleSheet.flatten(frame.props.contentContainerStyle as object) as { paddingHorizontal?: number }
  return ground.backgroundColor === theme.colors.background && f.marginHorizontal === -16 && c.paddingHorizontal === 16
}

it('sits on the page ground with a full-width scroll frame', () => {
  render(<MeTab />)
  expect(groundOk(screen.toJSON(), screen.UNSAFE_getAllByType(ScrollView)[0])).toBe(true)
})
