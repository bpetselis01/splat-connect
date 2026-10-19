// A failed guide-list load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => ({}), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

const NO_SAVES = { tutorials: [], toys: [], challenges: [] }
const guide = {
  id: '1', title: 'Build a Robot Arm', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, tutorial_orgs: [],
}

it('offline: says so, Try again re-fetches and shows the guides', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) =>
    p === '/api/saves/ids' ? Promise.resolve(NO_SAVES)
      : p === '/api/child-profiles' ? Promise.resolve([])
      : down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([guide])
  )
  render(<LibraryScreen />)
  expect(await screen.findByText("Couldn't load tutorials.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
