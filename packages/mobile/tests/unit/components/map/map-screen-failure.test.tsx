// A failed map load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MapScreen } from '../../../../components/map/map-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => ({}), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, loading: false }) }))
jest.mock('../../../../components/map/MapCanvas', () => ({ MapCanvas: () => null }))

it('offline: says so, Try again re-fetches', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<MapScreen />)
  expect(await screen.findByText('Could not load the map.')).toBeTruthy()
  mockGet.mockResolvedValueOnce([])
  fireEvent.press(screen.getByText('Try again'))
  await waitFor(() => expect(screen.queryByText('Could not load the map.')).toBeNull())
  expect(mockGet).toHaveBeenCalledTimes(2)
  expect(errSpy).not.toHaveBeenCalled()
})
