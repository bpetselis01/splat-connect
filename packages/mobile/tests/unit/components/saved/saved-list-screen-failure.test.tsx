// A failed saved-list load says so, retries on Try again, and never hits console.error.
// journeys: V08 V09
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SavedListScreen } from '../../../../components/saved/saved-list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({
    savedIds: { tutorials: [], toys: [], challenges: [], organisations: [], parts: [] },
    isSaved: () => true,
    toggle: jest.fn(),
  }),
}))

it('offline: says so, Try again re-fetches and shows the list', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true // mount and focus both fetch, so a one-shot rejection is not enough
  mockGet.mockImplementation(() =>
    down
      ? Promise.reject(new Error('Network request failed'))
      : Promise.resolve([{ id: 't1', title: 'Bubble machine', difficulty: 'easy', kind: 'toy_adaptation' }])
  )
  render(<SavedListScreen slug="tutorials" />)
  expect(await screen.findByText(/Couldn't load your saved/)).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
