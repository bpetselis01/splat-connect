// packages/mobile/tests/unit/app/auth-screens.test.tsx
// The sign-in flow's screens against a mocked auth context
// (docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md).
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import Welcome from '../../../app/(auth)/welcome'
import CreateAccount from '../../../app/(auth)/create-account'
import SignIn from '../../../app/(auth)/sign-in'
import CodeSignIn from '../../../app/(auth)/code-sign-in'
import Verify from '../../../app/(auth)/verify'
import ForgotPassword from '../../../app/(auth)/forgot-password'
import TermsGate from '../../../app/terms'
import NotBuilt from '../../../app/not-built'
import { toProblem } from '../../../lib/auth-errors'
import { BLANK, EMAILS, NAMES, PASSWORDS } from '../../special-strings'

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

// Each special string either reaches Supabase exactly (trimmed only where the
// screen trims) or comes back as a sentence that names the field to fix.
describe('Create account, special characters', () => {
  async function create(name: string, email: string, password: string) {
    render(<CreateAccount />)
    fireEvent.changeText(screen.getByLabelText('Your name'), name)
    fireEvent.changeText(screen.getByLabelText('Email'), email)
    fireEvent.changeText(screen.getByLabelText('Password'), password)
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('auth-submit'))
  }
  const answer = (server?: { status: number; code: string; message: string }) =>
    server ? { problem: toProblem(server) } : ok

  it.each(NAMES.map((c) => [c.label, c]))('name: %s', async (_l, c) => {
    mockAuth.signUp.mockResolvedValue(ok)
    await create(c.value, 'sam@example.com', 'secret1')
    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledWith('sam@example.com', 'secret1', c.value.trim()))
  })

  it.each(EMAILS.map((c) => [c.label, c]))('email: %s', async (_l, c) => {
    mockAuth.signUp.mockResolvedValue(answer(c.server))
    await create('Sam', c.value, 'secret1')
    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledWith(c.value.trim(), 'secret1', 'Sam'))
    if (c.server) expect(await screen.findByText("That email address doesn't look right. Check it for typos and try again.")).toBeTruthy()
    else expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: c.value.trim(), type: 'signup' } })
  })

  it.each(PASSWORDS.map((c) => [c.label, c]))('password: %s', async (_l, c) => {
    mockAuth.signUp.mockResolvedValue(answer(c.server))
    await create('Sam', 'sam@example.com', c.value)
    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledWith('sam@example.com', c.value, 'Sam'))
    if (c.server) expect(await screen.findByText('Use 72 characters or fewer for the password.')).toBeTruthy()
    else expect(mockPush).toHaveBeenCalled()
  })

  it.each([['name', BLANK, 'sam@example.com'], ['email', 'Sam', BLANK]])('a whitespace-only %s is refused on the screen', async (_l, name, email) => {
    await create(name, email, 'secret1')
    expect(screen.getByText('Add your name and email.')).toBeTruthy()
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })
})

describe('Sign in, special characters', () => {
  it.each([...EMAILS, ...PASSWORDS].map((c) => [c.label, c]))('%s reaches Supabase as typed, or says why not', async (_l, c) => {
    const isEmail = EMAILS.includes(c)
    const email = isEmail ? c.value : 'sam@example.com'
    const password = isEmail ? 'secret1' : c.value
    // Supabase answers a malformed email at sign-in as a plain credentials miss.
    mockAuth.signIn.mockResolvedValue({ problem: toProblem({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }) })
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), email)
    fireEvent.changeText(screen.getByLabelText('Password'), password)
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalledWith(email.trim(), password))
    expect(await screen.findByText("That email and password don't match.")).toBeTruthy()
  })

  it('refuses a whitespace-only email on the screen', () => {
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), BLANK)
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret1')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Add your email and password.')).toBeTruthy()
    expect(mockAuth.signIn).not.toHaveBeenCalled()
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

  it('opens the code screen carrying the typed email, with no request', () => {
    render(<SignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), ' sam@example.com ')
    fireEvent.press(screen.getByTestId('email-code'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/code-sign-in', params: { email: 'sam@example.com' } })
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
  })

  it('opens the code screen even with no email typed, and shows no error', () => {
    render(<SignIn />)
    fireEvent.press(screen.getByTestId('email-code'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/code-sign-in', params: { email: '' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('labels the code link as navigation', () => {
    render(<SignIn />)
    expect(screen.getByText('Email me a sign-in code ›')).toBeTruthy()
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

describe('Code sign-in', () => {
  const type = (v: string) => fireEvent.changeText(screen.getByLabelText('Email'), v)
  const send = () => fireEvent.press(screen.getByTestId('auth-submit'))

  it('shows the heading and lede, and opens the keyboard', () => {
    render(<CodeSignIn />)
    expect(screen.getByText('Sign in with a code')).toBeTruthy()
    expect(screen.getByText("We'll email you a 6-digit code. No password needed.")).toBeTruthy()
    expect(screen.getByLabelText('Email').props.autoFocus).toBe(true)
  })

  it('is prefilled from the email param', () => {
    mockParams = { email: 'sam@example.com' }
    render(<CodeSignIn />)
    expect(screen.getByLabelText('Email').props.value).toBe('sam@example.com')
  })

  it('sends the code and moves to the code screen', async () => {
    mockAuth.sendSignInCode.mockResolvedValue(ok)
    render(<CodeSignIn />)
    type(' sam@example.com ')
    send()
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: 'sam@example.com', type: 'email' } })
    )
    expect(mockAuth.sendSignInCode).toHaveBeenCalledWith('sam@example.com')
  })

  it('sends from the keyboard return key too', async () => {
    mockAuth.sendSignInCode.mockResolvedValue(ok)
    render(<CodeSignIn />)
    type('sam@example.com')
    fireEvent(screen.getByLabelText('Email'), 'submitEditing')
    await waitFor(() => expect(mockAuth.sendSignInCode).toHaveBeenCalledWith('sam@example.com'))
  })

  it.each([
    ['empty', '', 'Add your email.'],
    ['whitespace only', BLANK, 'Add your email.'],
    ['no at sign', 'sam.example.com', "That email address doesn't look right."],
    ['no domain dot', 'sam@example', "That email address doesn't look right."],
    ['inner space', 'sam smith@example.com', "That email address doesn't look right."],
  ])('%s: says so and sends nothing', (_l, value, message) => {
    render(<CodeSignIn />)
    type(value)
    send()
    expect(screen.getByText(message)).toBeTruthy()
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('offers Create an account when no account uses the email', async () => {
    mockAuth.sendSignInCode.mockResolvedValue({ problem: toProblem({ status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' }) })
    mockParams = { email: 'new@example.com' }
    render(<CodeSignIn />)
    send()
    expect(await screen.findByText('No account uses that email.')).toBeTruthy()
    fireEvent.press(screen.getByText('Create an account', { exact: true }))
    expect(mockReplace).toHaveBeenCalledWith('/create-account')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([
    ['rate limit', 'rate-limited', 'Too many tries. Wait a minute and try again.'],
    ['offline', 'offline', "You're offline. Check your connection and try again."],
  ])('shows the %s problem and stays put', async (_l, kind, message) => {
    mockAuth.sendSignInCode.mockResolvedValue({ problem: { kind, message } })
    mockParams = { email: 'sam@example.com' }
    render(<CodeSignIn />)
    send()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('goes back to password sign-in with the email', () => {
    render(<CodeSignIn />)
    type(' sam@example.com ')
    fireEvent.press(screen.getByText('Use a password instead'))
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { email: 'sam@example.com' } })
  })

  it.each(EMAILS.map((c) => [c.label, c]))('email: %s reaches Supabase trimmed, or says why not', async (_l, c) => {
    mockAuth.sendSignInCode.mockResolvedValue(c.server ? { problem: toProblem(c.server) } : ok)
    render(<CodeSignIn />)
    type(c.value)
    send()
    await waitFor(() => expect(mockAuth.sendSignInCode).toHaveBeenCalledWith(c.value.trim()))
    if (c.server) expect(await screen.findByText(/That email address doesn't look right/)).toBeTruthy()
    else expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: c.value.trim(), type: 'email' } })
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

  it('asks the OS for the emailed code and opens the keyboard', () => {
    mockParams = { email: 'sam@example.com', type: 'email' }
    render(<Verify />)
    const input = screen.getByTestId('code-input')
    expect(input.props.textContentType).toBe('oneTimeCode')
    expect(input.props.autoComplete).toBe('sms-otp')
    expect(input.props.autoFocus).toBe(true)
  })

  it('lets a code sign-in change the email', () => {
    mockParams = { email: 'sam@example.com', type: 'email' }
    render(<Verify />)
    fireEvent.press(screen.getByText('Wrong email? Change it'))
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/code-sign-in', params: { email: 'sam@example.com' } })
  })

  it('keeps going back for a sign-up code, with no Change link to the code screen', () => {
    mockParams = { email: 'sam@example.com', type: 'signup' }
    render(<Verify />)
    expect(screen.queryByText('Wrong email? Change it')).toBeNull()
    fireEvent.press(screen.getByText('Use a different email'))
    expect(mockBack).toHaveBeenCalled()
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
