// A failed review-queue load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AdminReviewQueueScreen } from '../../../../components/admin/admin-review-queue-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})

it('offline: says so, Try again re-fetches and shows the queue', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  mockGet.mockResolvedValue([])
  render(<AdminReviewQueueScreen />)
  expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Nothing waiting.')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
