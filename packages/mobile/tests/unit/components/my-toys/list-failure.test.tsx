// My toys when the shelf read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: W01
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyToysListScreen } from '../../../../components/my-toys/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me', name: 'Me' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 }, loading: false, refresh: jest.fn() }),
}))

const toy = {
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 8, switch_adapted: false,
  photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'draft', offer_type: null, created_at: '', updated_at: '',
}

afterEach(() => jest.restoreAllMocks())

it('says the shelf did not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((p: string) =>
    offline ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve(p === '/api/toys' ? [toy] : [])
  )
  render(<MyToysListScreen />)
  expect(await screen.findByText("Couldn't load your toys.")).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
