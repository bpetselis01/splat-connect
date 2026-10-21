// A failed registrations load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyEventsScreen } from '../../../../components/events/my-events-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and shows the events', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  mockGet.mockResolvedValue([])
  render(<MyEventsScreen />)
  expect(await screen.findByText('Could not load your events.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Nothing booked yet')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
