// A failed toy load says so, retries on Try again, and never hits console.error.
// journeys: Y04
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToyDetailScreen } from '../../../../components/toys/toy-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/recents', () => ({ recordRecent: jest.fn() }))
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
// RequestBlock's ErrorRow reaches auth-context, which reaches the live supabase client.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: null, loading: false, refresh: jest.fn() }),
}))

it('offline: says so, Try again re-fetches and shows the toy', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation(() =>
    down
      ? Promise.reject(new Error('Network request failed'))
      : Promise.resolve({ id: 'toy1', owner_id: 'owner1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: 'A gentle bubble maker.', condition: 8, switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation', created_at: '', updated_at: '', profiles: { name: 'Jamie' }, organizations: null })
  )
  render(<ToyDetailScreen id="toy1" />)
  expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect((await screen.findAllByText('Bubble machine')).length).toBeGreaterThan(0)
  expect(errSpy).not.toHaveBeenCalled()
})
