// packages/mobile/tests/unit/app/auth-layout.test.tsx
// The sign-up tile's one job: where the first sign-in lands.
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

const mockUpdateUser = jest.fn().mockResolvedValue({ error: null })
jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => mockUpdateUser(...a) } },
}))

const mockUseAuth = jest.fn()
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }))

const signedIn = (user_metadata: Record<string, unknown>) =>
  mockUseAuth.mockReturnValue({ loading: false, session: { user: { user_metadata } } })

beforeEach(() => jest.clearAllMocks())

describe('AuthLayout', () => {
  it.each([
    ['family', '/account'],
    ['maker', '/tutorials'],
  ])('lands a first-time %s on %s and spends the intent', (intent, href) => {
    signedIn({ intent })
    render(<AuthLayout />)
    expect(mockRedirect).toHaveBeenCalledWith(href)
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { intent_landed: true } })
  })

  it('goes to guides once the intent is spent, or when there was none', () => {
    signedIn({ intent: 'maker', intent_landed: true })
    render(<AuthLayout />)
    signedIn({})
    render(<AuthLayout />)
    expect(mockRedirect.mock.calls).toEqual([['/guides'], ['/guides']])
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
