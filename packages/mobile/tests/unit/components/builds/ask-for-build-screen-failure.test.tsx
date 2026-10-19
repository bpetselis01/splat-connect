// A failed guide-list load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AskForBuildScreen } from '../../../../components/builds/ask-for-build-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))

it('offline: says so, Try again re-fetches and lists the guides', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  mockGet.mockResolvedValue([{ id: 'g1', title: 'Bubble guide', difficulty: 'easy', build_minutes: 20 }])
  render(<AskForBuildScreen />)
  expect(await screen.findByText("Couldn't load the guides.")).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble guide')).toBeTruthy()
  expect(screen.queryByText("Couldn't load the guides.")).toBeNull()
  expect(errSpy).not.toHaveBeenCalled()
})
