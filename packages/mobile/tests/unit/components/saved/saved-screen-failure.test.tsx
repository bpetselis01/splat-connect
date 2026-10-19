// A failed saves load says so, retries on Try again, and never hits console.error.
// journeys: V07
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SavedScreen } from '../../../../components/saved/saved-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and shows the tiles', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true // mount and focus both fetch, so a one-shot rejection is not enough
  mockGet.mockImplementation(() =>
    down
      ? Promise.reject(new Error('Network request failed'))
      : Promise.resolve({ tutorials: [], toys: [], challenges: [], organisations: [], parts: [] })
  )
  render(<SavedScreen />)
  expect(await screen.findByText("Couldn't load what you've saved.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Guides')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
