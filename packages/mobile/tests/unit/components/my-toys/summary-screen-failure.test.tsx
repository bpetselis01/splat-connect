// A failed toy load says so, retries on Try again, and never hits console.error.
// journeys: W03
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: jest.fn(),
  useCapabilities: () => ({ caps: { profile: { id: 'me', name: 'Sam' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))

const toy = {
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Light-up drum', description: null, condition: 8,
  switch_adapted: true, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '2026-06-04T12:00:00Z', updated_at: '',
}

it('offline: says so, Try again re-fetches and shows the toy', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockImplementation((p: string) => (p === '/api/toys' ? Promise.resolve([toy]) : Promise.resolve([])))
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<ToySummaryScreen id="t1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted.')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
