// A failed event load says so, retries on Try again, and never reaches console.error.
// journeys: V01
import { render, screen, fireEvent } from '@testing-library/react-native'
import { EventRegisterScreen } from '../../../../components/events/event-register-screen'
import { event } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { name: 'Priya Nair', email: 'priya@example.com' } } }),
}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ replace: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and shows the form', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(event())
  render(<EventRegisterScreen id="e1" />)
  expect(await screen.findByText('Could not load this event.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByDisplayValue('Priya Nair')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledTimes(2)
  expect(errSpy).not.toHaveBeenCalled()
})
