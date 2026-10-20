// A failed event load says so, retries on Try again, and never reaches console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { EventDetailScreen } from '../../../../components/events/event-detail-screen'
import { event } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: null }) }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and shows the event', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(event())
  render(<EventDetailScreen id="e1" />)
  expect(await screen.findByText('Could not load this event.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Switch-adapted toy build day')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledTimes(2)
  expect(errSpy).not.toHaveBeenCalled()
})
