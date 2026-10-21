import { render, screen, fireEvent } from '@testing-library/react-native'
import { MakersWantedScreen } from '../../../../components/builds/makers-wanted-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})
const mockCaps = { current: null as null | { profile: Record<string, unknown> } }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps.current }) }))

const build = (id: string, km: number | null, suburb: string) => ({
  id, tutorial_id: 'g', build_brief: 'Please.', travel_km: 30, urgency: null, requester_suburb: suburb,
  family_has_toy: false, created_at: new Date().toISOString(), mine: false, km,
  tutorial: { id: 'g', title: 'Bubble machine', difficulty: 'easy', status: 'approved' },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
})

it('K01 asks for a postcode before it filters by distance', async () => {
  mockGet.mockResolvedValue([build('b1', null, 'Newtown')])
  render(<MakersWantedScreen />)
  fireEvent.press(await screen.findByText('Add your postcode'))
  expect(mockPush).toHaveBeenCalledWith('/account')
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds')
})

it('K01 filters on the real distance from the maker, and says it on the row', async () => {
  mockCaps.current = { profile: { id: 'me', pickup_postcode: '2000' } }
  mockGet.mockResolvedValue([build('b1', 4, 'Newtown'), build('b2', 40, 'Penrith')])
  render(<MakersWantedScreen />)
  expect(await screen.findByText('4 km away')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds?near=2000')
  fireEvent.press(screen.getByText('10 km'))
  expect(screen.queryByText(/Penrith/)).toBeNull()
})

/** Tasks 13–15's rows: no distance, and the guide's time and cost (makers-row-meta). */
export const row = (over: object = {}) => ({
  id: 'b1', tutorial_id: 'g1', build_brief: 'A child lights up at bubbles.', travel_km: 10, urgency: 'No rush',
  requester_suburb: 'Newtown', family_has_toy: false, created_at: '2026-09-28T00:00:00Z', mine: false, km: null,
  tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
  ...over,
})

it('shows each guide’s build time and rough parts cost', async () => {
  mockGet.mockResolvedValue([row()])
  render(<MakersWantedScreen />)
  expect(await screen.findByText('20 min · ~$28.00')).toBeTruthy()
})

it('leaves the cost off when a part is unpriced', async () => {
  mockGet.mockResolvedValue([
    row({ tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: null } }),
  ])
  render(<MakersWantedScreen />)
  expect(await screen.findByText('20 min')).toBeTruthy()
  expect(screen.queryByText(/~\$/)).toBeNull()
})

it('K01 reads Live and Done from the board feed, naming the maker', async () => {
  mockGet.mockImplementation((path: string) =>
    path.startsWith('/api/toy-transactions/builds-board?tab=live')
      ? Promise.resolve([row({ id: 'l1', maker_name: 'Tom Beattie', party: false })])
      : path.startsWith('/api/toy-transactions/builds-board?tab=done')
        ? Promise.resolve([
            row({
              id: 'd1', maker_name: 'Rachel Kaur', party: false, build_brief: null,
              requester_suburb: null, travel_km: null, urgency: null, updated_at: '2026-09-30T00:00:00Z',
            }),
          ])
        : Promise.resolve([row()])
  )
  render(<MakersWantedScreen />)
  const live = await screen.findByRole('tab', { name: 'Live' })
  expect(live.props.accessibilityValue?.text).toBeUndefined()
  fireEvent.press(live)
  expect(await screen.findByText('Tom Beattie is building it')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/builds-board?tab=live&page=0')
  fireEvent.press(screen.getByRole('tab', { name: 'Done' }))
  expect(await screen.findByText('Built by Rachel Kaur')).toBeTruthy()
  expect(screen.getByText('Handed over')).toBeTruthy()
  expect(screen.queryByText(/null/)).toBeNull()
})

it('K14 offers the thread on a live build of your own', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path.includes('tab=live') ? [row({ id: 'l1', maker_name: 'Tom Beattie', party: true })] : [])
  )
  render(<MakersWantedScreen />)
  fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
  expect(await screen.findByText('You are building it')).toBeTruthy()
  fireEvent.press(screen.getByText('Thread'))
  expect(mockPush).toHaveBeenCalledWith('/exchanges/build/l1')
})

it('opens Ask first for an open request', async () => {
  mockGet.mockResolvedValue([row()])
  render(<MakersWantedScreen />)
  fireEvent.press(await screen.findByRole('button', { name: 'Ask first' }))
  expect(mockPush).toHaveBeenCalledWith('/exchanges/build/ask/b1')
})
