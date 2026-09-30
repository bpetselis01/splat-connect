// packages/mobile/tests/unit/app/auth-layout.test.tsx
// The signed-out stack's one decision: a session means sign-in worked.
import { render } from '@testing-library/react-native'
import AuthLayout from '../../../app/(auth)/_layout'

const mockRedirect = jest.fn()
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
  Stack: () => null,
}))

const mockUseAuth = jest.fn()
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }))

beforeEach(() => jest.clearAllMocks())

describe('AuthLayout', () => {
  it('sends a session to Guides', () => {
    mockUseAuth.mockReturnValue({ loading: false, session: { user: { user_metadata: {} } } })
    render(<AuthLayout />)
    expect(mockRedirect).toHaveBeenCalledWith('/guides')
  })

  it('shows the stack when signed out', () => {
    mockUseAuth.mockReturnValue({ loading: false, session: null })
    render(<AuthLayout />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
