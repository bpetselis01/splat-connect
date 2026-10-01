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
  id, tutorial_id: 'g', build_brief: 'Please.', travel_km: 30, urgency: null, child_label: null, requester_suburb: suburb,
  family_has_toy: false, created_at: new Date().toISOString(), mine: false, km,
  tutorial: { id: 'g', title: 'Bubble machine', difficulty: 'easy', status: 'approved' },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
})

it('asks for a postcode before it filters by distance', async () => {
  mockGet.mockResolvedValue([build('b1', null, 'Newtown')])
  render(<MakersWantedScreen />)
  fireEvent.press(await screen.findByText('Add your postcode'))
  expect(mockPush).toHaveBeenCalledWith('/account')
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds')
})

it('filters on the real distance from the maker, and says it on the row', async () => {
  mockCaps.current = { profile: { id: 'me', pickup_postcode: '2000' } }
  mockGet.mockResolvedValue([build('b1', 4, 'Newtown'), build('b2', 40, 'Penrith')])
  render(<MakersWantedScreen />)
  expect(await screen.findByText('4 km away')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds?near=2000')
  fireEvent.press(screen.getByText('10 km'))
  expect(screen.queryByText(/Penrith/)).toBeNull()
})
