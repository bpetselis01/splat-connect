// packages/mobile/tests/unit/app/auth-screens.test.tsx
// The sign-in flow's screens against a mocked auth context
// (docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md).
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import Welcome from '../../../app/(auth)/welcome'
import CreateAccount from '../../../app/(auth)/create-account'
import SignIn from '../../../app/(auth)/sign-in'
import Verify from '../../../app/(auth)/verify'
import ForgotPassword from '../../../app/(auth)/forgot-password'
import TermsGate from '../../../app/terms'
import NotBuilt from '../../../app/not-built'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockRedirect = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
}))

jest.mock('../../../lib/social-auth', () => ({
  appleAvailable: () => Promise.resolve(false),
  googleAvailable: () => false,
  AppleButton: () => null,
}))

const ok = { problem: null }
const mockAuth = {
  loading: false,
  session: { user: { id: 'u1' } },
  profile: { name: 'Sam' },
  hasContributorTerms: false,
  pendingName: null as string | null,
  signIn: jest.fn(),
  signUp: jest.fn(),
  verifyCode: jest.fn(),
  resendSignupCode: jest.fn(),
  sendSignInCode: jest.fn(),
  sendPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithSavedGoogle: jest.fn(() => Promise.resolve(null)),
  setProfileName: jest.fn(),
  acceptContributorTerms: jest.fn(),
  signOut: jest.fn(),
}
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => mockAuth }))

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockAuth.profile = { name: 'Sam' }
  mockAuth.pendingName = null
  mockAuth.hasContributorTerms = false
})

describe('Welcome', () => {
  it('opens Create account and Sign in', () => {
    render(<Welcome />)
    fireEvent.press(screen.getByTestId('welcome-get-started'))
    expect(mockPush).toHaveBeenCalledWith('/create-account')
    fireEvent.press(screen.getByTestId('welcome-sign-in'))
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })
})

describe('Create account', () => {
  function fill() {
    fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam')
    fireEvent.changeText(screen.getByLabelText('Email'), ' sam@example.com ')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret1')
  }

  it('keeps Create off until the terms are ticked', () => {
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })

  it('ends on the code screen', async () => {
    mockAuth.signUp.mockResolvedValue(ok)
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: 'sam@example.com', type: 'signup' } })
    )
    expect(mockAuth.signUp).toHaveBeenCalledWith('sam@example.com', 'secret1', 'Sam')
  })

  it('offers to sign in when the email already has an account', async () => {
    mockAuth.signUp.mockResolvedValue({ problem: { kind: 'registered', message: 'That email already has an account.' } })
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    fireEvent.press(await screen.findByText('Sign in as sam@example.com'))
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { email: 'sam@example.com' } })
  })

  it('refuses a short password before any request', () => {
    render(<CreateAccount />)
    fill()
    fireEvent.changeText(screen.getByLabelText('Password'), '123')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Use at least 6 characters for the password.')).toBeTruthy()
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })
})

describe('Sign in', () => {
  it('clears the password, not the email, on bad credentials', async () => {
    mockAuth.signIn.mockResolvedValue({ problem: { kind: 'credentials', message: "That email and password don't match." } })
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'nope')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText("That email and password don't match.")).toBeTruthy()
    expect(screen.getByLabelText('Password').props.value).toBe('')
    expect(screen.getByLabelText('Email').props.value).toBe('sam@example.com')
  })

  it('moves an unconfirmed account to the code screen', async () => {
    mockAuth.signIn.mockResolvedValue({ problem: { kind: 'unconfirmed', message: 'x' } })
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'pw')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: 'sam@example.com', type: 'signup' } })
    )
  })

  it('emails a code and offers Create when no account uses the email', async () => {
    mockAuth.sendSignInCode.mockResolvedValue({ problem: { kind: 'no-account', message: 'No account uses that email.' } })
    mockParams = { email: 'new@example.com' }
    render(<SignIn />)
    fireEvent.press(screen.getByTestId('email-code'))
    fireEvent.press(await screen.findByText('Create an account', { exact: true }))
    expect(mockAuth.sendSignInCode).toHaveBeenCalledWith('new@example.com')
  })

  it('asks for the email before sending a code', () => {
    render(<SignIn />)
    fireEvent.press(screen.getByTestId('email-code'))
    expect(screen.getByText('Type your email first, then we can send a code.')).toBeTruthy()
  })

  it('carries the email to Forgot password', () => {
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com')
    fireEvent.press(screen.getByTestId('forgot-password'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/forgot-password', params: { email: 'sam@example.com' } })
  })

  it('sends Google to the Not built yet screen while this build has no client id', () => {
    render(<SignIn />)
    fireEvent.press(screen.getByTestId('google-sign-in'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'google-sign-in' } })
    expect(mockAuth.signInWithGoogle).not.toHaveBeenCalled()
  })

  // android-one-tap: one silent try on arrival; nothing on screen either way.
  it('tries the saved Google account once on arrival and says nothing', async () => {
    render(<SignIn />)
    await waitFor(() => expect(mockAuth.signInWithSavedGoogle).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Verify', () => {
  it('checks the code on the sixth digit and clears it when wrong', async () => {
    mockParams = { email: 'sam@example.com', type: 'email' }
    mockAuth.verifyCode.mockResolvedValue({ problem: { kind: 'bad-code', message: "That code didn't work. Check the latest email, or send a new one." } })
    render(<Verify />)
    fireEvent.changeText(screen.getByTestId('code-input'), '12 34-56')
    await waitFor(() => expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'email'))
    expect(await screen.findByText(/That code didn't work/)).toBeTruthy()
    expect(screen.getByTestId('code-input').props.value).toBe('')
  })
})

describe('Forgot password', () => {
  it('moves on whether or not the account exists', async () => {
    mockAuth.sendPasswordReset.mockResolvedValue({ problem: { kind: 'other', message: 'User not found' } })
    mockParams = { email: 'who@example.com' }
    render(<ForgotPassword />)
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/reset-password', params: { email: 'who@example.com' } })
    )
  })

  it('stops when offline', async () => {
    mockAuth.sendPasswordReset.mockResolvedValue({ problem: { kind: 'offline', message: "You're offline." } })
    mockParams = { email: 'who@example.com' }
    render(<ForgotPassword />)
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText("You're offline.")).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('Terms gate', () => {
  it('asks for a name only when the profile has none, pre-filled from Apple', async () => {
    mockAuth.profile = { name: '' }
    mockAuth.pendingName = 'Sam Mitchell'
    mockAuth.setProfileName.mockResolvedValue(ok)
    mockAuth.acceptContributorTerms.mockResolvedValue({ error: null })
    render(<TermsGate />)
    expect(screen.getByLabelText('Your name').props.value).toBe('Sam Mitchell')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('accept-terms'))
    await waitFor(() => expect(mockAuth.acceptContributorTerms).toHaveBeenCalled())
    expect(mockAuth.setProfileName).toHaveBeenCalledWith('Sam Mitchell')
  })

  it('skips the name field when the provider gave one', () => {
    render(<TermsGate />)
    expect(screen.queryByLabelText('Your name')).toBeNull()
  })

  it('sends an accepted account on to Guides', () => {
    mockAuth.hasContributorTerms = true
    render(<TermsGate />)
    expect(mockRedirect).toHaveBeenCalledWith('/guides')
  })
})

describe('Not built yet', () => {
  it('names the pending feature and goes back', () => {
    mockParams = { feature: 'apple-sign-in' }
    render(<NotBuilt />)
    expect(screen.getByText('Not built yet')).toBeTruthy()
    expect(screen.getByText('Sign in with Apple')).toBeTruthy()
    fireEvent.press(screen.getByTestId('not-built-back'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('falls back to a generic line for an unknown feature', () => {
    mockParams = { feature: 'nope' }
    render(<NotBuilt />)
    expect(screen.getByText("This part of SPLAT Connect isn't ready yet.")).toBeTruthy()
  })
})
