// A failed toy-library load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, loading: false, refresh: jest.fn() }) }))

it('Y01 offline: says so, Try again re-fetches and shows the toys', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) =>
    p === '/api/child-profiles'
      ? Promise.resolve([])
      : down
        ? Promise.reject(new Error('Network request failed'))
        : Promise.resolve([{ id: 't1', owner_id: 'u1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 8, switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation', created_at: '', updated_at: '', profiles: { name: 'Jamie' }, organizations: null }])
  )
  render(<ToyLibraryScreen />)
  expect(await screen.findByText("Couldn't load toys.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
