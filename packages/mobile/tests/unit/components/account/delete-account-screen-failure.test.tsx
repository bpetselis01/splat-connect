// A failed deletion-preview load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { DeleteAccountScreen } from '../../../../components/account/delete-account-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('../../../../lib/social-auth', () => ({ appleAvailable: () => Promise.resolve(false), googleAvailable: () => false, AppleButton: () => null }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: jest.fn() } }))
jest.mock('../../../../lib/auth-context', () => ({
  useAuth: () => ({
    session: { user: { email: 'sam@example.com', app_metadata: { providers: ['email'] } } },
    sendSignInCode: jest.fn(), verifyCode: jest.fn(), reauthWithApple: jest.fn(), signOut: jest.fn(),
  }),
}))

it('offline: says so, Try again re-fetches and shows the review', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  mockGet.mockResolvedValue({ open: [], childProfiles: 0, publishedGuides: 0, soleLedOrgs: [] })
  render(<DeleteAccountScreen />)
  expect(await screen.findByText('Could not load your account. Check your connection and try again.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByTestId('delete-send-code')).toBeTruthy()
  expect(screen.queryByText('Could not load your account. Check your connection and try again.')).toBeNull()
  expect(errSpy).not.toHaveBeenCalled()
})
