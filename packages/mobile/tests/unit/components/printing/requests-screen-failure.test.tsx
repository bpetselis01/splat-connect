// A failed print-requests load says so, retries on Try again, and never hits console.error.
// journeys: R18
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintRequestsScreen } from '../../../../components/printing/requests-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (e: () => void) => useEffect(e, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: 'family' } } }) }))

it('offline: says so, Try again re-fetches and shows the list', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue([])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText("Couldn't load your print requests.")).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('New request')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
