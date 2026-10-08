// A failed questions load says so, retries on Try again, and never hits console.error.
// journeys: K04
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AskFirstScreen } from '../../../../components/builds/ask-first-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ replace: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: 'm1', name: 'Me' } } }) }))

it('offline: says so, Try again re-fetches and shows the board', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({
    transaction_id: 'b1',
    tutorial_title: 'Bubble machine',
    requester_suburb: 'Newtown',
    open: true,
    family: false,
    threads: [],
  })
  render(<AskFirstScreen id="b1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledTimes(2)
  expect(errSpy).not.toHaveBeenCalled()
})
