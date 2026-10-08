// Makers wanted when the board read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: K02
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MakersWantedScreen } from '../../../../components/builds/makers-wanted-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  }
})
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, loading: false }) }))

const row = {
  id: 'b1', tutorial_id: 'g1', build_brief: null, travel_km: 30, urgency: null, child_label: null, requester_suburb: 'Newtown',
  family_has_toy: false, created_at: new Date().toISOString(), mine: false, km: null,
  tutorial: { id: 'g1', title: 'Guide b1', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
}

afterEach(() => jest.restoreAllMocks())

it('says the board could not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation(() => (offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve([row])))
  render(<MakersWantedScreen />)
  expect(await screen.findByText("Couldn't load the board.")).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Guide b1')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
