// A failed profile load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ShowcaseScreen } from '../../../../components/guides/showcase-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: null }) }))

it('offline: says so, Try again re-fetches and shows the profile', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  mockGet.mockResolvedValue({ id: 'c1', name: 'Sam Taylor', tutorials: [], toysShared: [], toysDelivered: [], thanks: 1 })
  render(<ShowcaseScreen kind="person" id="c1" />)
  expect(await screen.findByText("Couldn't load this profile.")).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Sam Taylor')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
