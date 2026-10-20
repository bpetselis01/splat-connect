// A failed child-profiles load says so (never "no children"), retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
// ErrorRow reaches auth-context, which reaches the live supabase client.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and shows the empty list', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true // mount and focus both fetch, so a one-shot rejection is not enough
  mockGet.mockImplementation(() => (down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])))
  render(<ChildProfileHome />)
  expect(await screen.findByText(/Couldn't load your child profiles/)).toBeTruthy()
  expect(screen.queryByText(/No child profiles yet/)).toBeNull()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText(/No child profiles yet/)).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
