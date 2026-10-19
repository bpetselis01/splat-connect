// A failed queue load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ReviewQueueScreen } from '../../../../components/organisation/review-queue-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: jest.fn() }),
}))

it('offline: says so, Try again re-fetches and shows the queue', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  // Focus re-fetches on mount, so answer by state rather than by call count.
  mockGet.mockImplementation(() => (down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])))
  render(<ReviewQueueScreen />)
  expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Nothing waiting.')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
