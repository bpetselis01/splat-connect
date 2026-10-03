// Edge inputs and repeat taps on the sign-in flow's screens, against a mocked
// auth context: the keyboard's return key, a second tap while a request is in
// flight, a short or lettered code, resend throttling and network failures.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import CreateAccount from '../../../app/(auth)/create-account'
import SignIn from '../../../app/(auth)/sign-in'
import CodeSignIn from '../../../app/(auth)/code-sign-in'
import Verify from '../../../app/(auth)/verify'
import ForgotPassword from '../../../app/(auth)/forgot-password'
import ResetPassword from '../../../app/(auth)/reset-password'
import { problem } from '../../../lib/auth-errors'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('../../../lib/social-auth', () => ({
  appleAvailable: () => Promise.resolve(false),
  googleAvailable: () => false,
  AppleButton: () => null,
}))

const ok = { problem: null }
const mockAuth = {
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
}
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => mockAuth }))

/** A request the test settles by hand, to tap again while it is in flight. */
function pending<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
})

describe('Create account, repeat and edge input', () => {
  function fill(password = 'secret1', ticked = true) {
    fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam')
    fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), password)
    if (ticked) fireEvent.press(screen.getByTestId('accept-contributor-terms'))
  }

  it('the keyboard return key does not create the account while the terms are unticked', () => {
    render(<CreateAccount />)
    fill('secret1', false)
    fireEvent(screen.getByLabelText('Password'), 'submitEditing')
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })

  it('a second return key while the first sign-up is in flight sends one request', async () => {
    const slow = pending<typeof ok>()
    mockAuth.signUp.mockReturnValue(slow.promise)
    render(<CreateAccount />)
    fill()
    fireEvent(screen.getByLabelText('Password'), 'submitEditing')
    fireEvent(screen.getByLabelText('Password'), 'submitEditing')
    await act(async () => slow.resolve(ok))
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('tapping Create twice while the request is in flight sends one request', async () => {
    const slow = pending<typeof ok>()
    mockAuth.signUp.mockReturnValue(slow.promise)
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    await act(async () => slow.resolve(ok))
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1)
  })

  it('accepts a password of exactly six characters and refuses five', async () => {
    mockAuth.signUp.mockResolvedValue(ok)
    render(<CreateAccount />)
    fill('12345')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Use at least 6 characters for the password.')).toBeTruthy()
    expect(mockAuth.signUp).not.toHaveBeenCalled()
    fireEvent.changeText(screen.getByLabelText('Password'), '123456')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledWith('sam@example.com', '123456', 'Sam'))
  })

  it('stays on the screen, with the offline sentence, when the network is down', async () => {
    mockAuth.signUp.mockResolvedValue({ problem: problem('offline') })
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('clears the last error when the next attempt succeeds', async () => {
    mockAuth.signUp.mockResolvedValueOnce({ problem: problem('rate-limited') }).mockResolvedValueOnce(ok)
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(screen.queryByText('Too many tries. Wait a minute and try again.')).toBeNull()
  })

  it('the sign-in shortcut after "already has an account" carries the trimmed email', async () => {
    mockAuth.signUp.mockResolvedValue({ problem: problem('registered') })
    render(<CreateAccount />)
    fill()
    fireEvent.changeText(screen.getByLabelText('Email'), '  sam@example.com  ')
    fireEvent.press(screen.getByTestId('auth-submit'))
    fireEvent.press(await screen.findByText('Sign in as sam@example.com'))
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { email: 'sam@example.com' } })
  })

  it('un-ticking the terms switches Create off again', () => {
    render(<CreateAccount />)
    fill()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })
})

describe('Sign in, repeat and failure states', () => {
  function fill(email = 'sam@example.com', password = 'secret1') {
    fireEvent.changeText(screen.getByLabelText('Email'), email)
    fireEvent.changeText(screen.getByLabelText('Password'), password)
  }

  it('a second return key while signing in sends one request', async () => {
    const slow = pending<typeof ok>()
    mockAuth.signIn.mockReturnValue(slow.promise)
    render(<SignIn />)
    fill()
    fireEvent(screen.getByLabelText('Password'), 'submitEditing')
    fireEvent(screen.getByLabelText('Password'), 'submitEditing')
    await act(async () => slow.resolve(ok))
    expect(mockAuth.signIn).toHaveBeenCalledTimes(1)
  })

  it('tapping Sign in twice while the request is in flight sends one request', async () => {
    const slow = pending<typeof ok>()
    mockAuth.signIn.mockReturnValue(slow.promise)
    render(<SignIn />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    fireEvent.press(screen.getByTestId('auth-submit'))
    await act(async () => slow.resolve(ok))
    expect(mockAuth.signIn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['offline', "You're offline. Check your connection and try again."],
    ['rate-limited', 'Too many tries. Wait a minute and try again.'],
  ] as const)('%s keeps the typed password so a retry is one tap', async (kind, sentence) => {
    mockAuth.signIn.mockResolvedValue({ problem: problem(kind) })
    render(<SignIn />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText(sentence)).toBeTruthy()
    expect(screen.getByLabelText('Password').props.value).toBe('secret1')
  })

  it('an unconfirmed account goes to the code screen with no error shown', async () => {
    mockAuth.signIn.mockResolvedValue({ problem: problem('unconfirmed') })
    render(<SignIn />)
    fill(' sam@example.com ')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify', params: { email: 'sam@example.com', type: 'signup' } })
    )
    expect(screen.queryByText(/not confirmed/)).toBeNull()
  })

  it('a missing password is refused before any request, with the email kept', () => {
    render(<SignIn />)
    fill('sam@example.com', '')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Add your email and password.')).toBeTruthy()
    expect(mockAuth.signIn).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email').props.value).toBe('sam@example.com')
  })

  it('a successful sign-in navigates nowhere itself, the auth layout redirects', async () => {
    mockAuth.signIn.mockResolvedValue(ok)
    render(<SignIn />)
    fill()
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('the password is hidden until the eye is pressed, and hidden again after', () => {
    render(<SignIn />)
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true)
    fireEvent.press(screen.getByLabelText('Show password'))
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false)
    fireEvent.press(screen.getByLabelText('Hide password'))
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true)
  })
})

describe('Code sign-in, email shapes and repeat taps', () => {
  const send = (email: string) => {
    fireEvent.changeText(screen.getByLabelText('Email'), email)
    fireEvent.press(screen.getByTestId('auth-submit'))
  }

  it.each(['plain', 'a@b', 'a b@c.de', 'a@@b.co', '@b.co', 'a@.co', 'sam@example.', '🧸'])(
    'refuses %j on the screen, before any request',
    (email) => {
      render(<CodeSignIn />)
      send(email)
      expect(screen.getByText("That email address doesn't look right.")).toBeTruthy()
      expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
    }
  )

  it.each(['sam+tag@example.com', "o'brien@example.co.uk", 'a@b.cd', 'sam%1@example.com'])('sends %j as typed', async (email) => {
    mockAuth.sendSignInCode.mockResolvedValue(ok)
    render(<CodeSignIn />)
    send(email)
    await waitFor(() => expect(mockAuth.sendSignInCode).toHaveBeenCalledWith(email))
  })

  it('a second return key while the code is being sent sends one email', async () => {
    const slow = pending<typeof ok>()
    mockAuth.sendSignInCode.mockReturnValue(slow.promise)
    render(<CodeSignIn />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com')
    fireEvent(screen.getByLabelText('Email'), 'submitEditing')
    fireEvent(screen.getByLabelText('Email'), 'submitEditing')
    await act(async () => slow.resolve(ok))
    expect(mockAuth.sendSignInCode).toHaveBeenCalledTimes(1)
  })

  it('stays put with the rate-limit sentence when Supabase says too many', async () => {
    mockAuth.sendSignInCode.mockResolvedValue({ problem: problem('rate-limited') })
    render(<CodeSignIn />)
    send('sam@example.com')
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('Verify, the code and the resend', () => {
  const type = (text: string) => fireEvent.changeText(screen.getByTestId('code-input'), text)

  beforeEach(() => {
    mockParams = { email: 'sam@example.com', type: 'signup' }
    mockAuth.verifyCode.mockResolvedValue({ problem: problem('bad-code') })
  })

  it.each(['1', '12345', '12345 ', 'abcde'])('%j is too short to check', (text) => {
    render(<Verify />)
    type(text)
    expect(mockAuth.verifyCode).not.toHaveBeenCalled()
  })

  it('letters alone leave the field empty and check nothing', () => {
    render(<Verify />)
    type('abcdef')
    expect(screen.getByTestId('code-input').props.value).toBe('')
    expect(mockAuth.verifyCode).not.toHaveBeenCalled()
  })

  it('letters between the digits are dropped, and the six digits are checked', async () => {
    render(<Verify />)
    type('1a2b3c4d5e6f')
    await waitFor(() => expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'signup'))
  })

  it('a pasted code with spaces is checked as its six digits', async () => {
    render(<Verify />)
    type(' 123 456 ')
    await waitFor(() => expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'signup'))
  })

  it('a pasted code longer than six keeps the first six, checked once', async () => {
    render(<Verify />)
    type('123456789')
    await waitFor(() => expect(mockAuth.verifyCode).toHaveBeenCalledTimes(1))
    expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'signup')
  })

  it('emoji and RTL digits are not digits', () => {
    render(<Verify />)
    type('🧸🧸🧸🧸🧸🧸')
    type('١٢٣٤٥٦')
    expect(mockAuth.verifyCode).not.toHaveBeenCalled()
  })

  it('the code input must accept a pasted code with spaces, so it sets no length cap below what a paste is', () => {
    // A native maxLength truncates the paste to its first six characters
    // before onChangeText runs, so "123 456" would arrive as "123 45".
    render(<Verify />)
    expect(screen.getByTestId('code-input').props.maxLength).toBeUndefined()
  })

  it('a wrong code, then the right one, signs in', async () => {
    mockAuth.verifyCode.mockResolvedValueOnce({ problem: problem('bad-code') }).mockResolvedValueOnce(ok)
    render(<Verify />)
    type('000000')
    expect(await screen.findByText(/That code didn't work/)).toBeTruthy()
    type('123456')
    await waitFor(() => expect(mockAuth.verifyCode).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(/That code didn't work/)).toBeNull())
  })

  it('offline while checking says so and empties the field to retry', async () => {
    mockAuth.verifyCode.mockResolvedValue({ problem: problem('offline') })
    render(<Verify />)
    type('123456')
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByTestId('code-input').props.value).toBe('')
  })

  it('shows Checking… while the sixth digit is out', async () => {
    const slow = pending<typeof ok>()
    mockAuth.verifyCode.mockReturnValue(slow.promise)
    render(<Verify />)
    type('123456')
    expect(screen.getByText('Checking…')).toBeTruthy()
    await act(async () => slow.resolve(ok))
    expect(screen.queryByText('Checking…')).toBeNull()
  })

  it('renders the email as typed, even with markup characters, and survives no email at all', () => {
    mockParams = { email: '<b>"o\'brien"</b>&co@example.com', type: 'signup' }
    render(<Verify />)
    expect(screen.getByText('<b>"o\'brien"</b>&co@example.com')).toBeTruthy()
  })

  describe('resend throttling', () => {
    // The countdown re-arms its timer after each render, so it runs a second at a time.
    const tick = (seconds: number) => {
      for (let i = 0; i < seconds; i++) act(() => jest.advanceTimersByTime(1000))
    }
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('offers no resend for the first minute, counting down', () => {
      render(<Verify />)
      expect(screen.getByText('Resend code in 0:60')).toBeTruthy()
      expect(screen.queryByTestId('resend-code')).toBeNull()
      tick(59)
      expect(screen.getByText('Resend code in 0:01')).toBeTruthy()
      expect(screen.queryByTestId('resend-code')).toBeNull()
    })

    it('pads the seconds, 0:09 not 0:9', () => {
      render(<Verify />)
      tick(51)
      expect(screen.getByText('Resend code in 0:09')).toBeTruthy()
    })

    it('after a minute a sign-up code is resent as a sign-up code, and the minute starts over', async () => {
      mockAuth.resendSignupCode.mockResolvedValue(ok)
      render(<Verify />)
      tick(60)
      await act(async () => fireEvent.press(screen.getByTestId('resend-code')))
      expect(mockAuth.resendSignupCode).toHaveBeenCalledWith('sam@example.com')
      expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
      expect(screen.getByText('Resend code in 0:60')).toBeTruthy()
      expect(screen.queryByTestId('resend-code')).toBeNull()
    })

    it('a sign-in code is resent as a sign-in code', async () => {
      mockParams = { email: 'sam@example.com', type: 'email' }
      mockAuth.sendSignInCode.mockResolvedValue(ok)
      render(<Verify />)
      tick(60)
      await act(async () => fireEvent.press(screen.getByTestId('resend-code')))
      expect(mockAuth.sendSignInCode).toHaveBeenCalledWith('sam@example.com')
      expect(mockAuth.resendSignupCode).not.toHaveBeenCalled()
    })

    it('a refused resend shows why and leaves the link for another try, without restarting the minute', async () => {
      mockAuth.resendSignupCode.mockResolvedValue({ problem: problem('rate-limited') })
      render(<Verify />)
      tick(60)
      await act(async () => fireEvent.press(screen.getByTestId('resend-code')))
      expect(screen.getByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
      expect(screen.getByTestId('resend-code')).toBeTruthy()
    })

    it('tapping resend twice before the first answers sends one email', async () => {
      const slow = pending<typeof ok>()
      mockAuth.resendSignupCode.mockReturnValue(slow.promise)
      render(<Verify />)
      tick(60)
      fireEvent.press(screen.getByTestId('resend-code'))
      fireEvent.press(screen.getByTestId('resend-code'))
      await act(async () => slow.resolve(ok))
      expect(mockAuth.resendSignupCode).toHaveBeenCalledTimes(1)
    })

    it('a resend clears the error a wrong code left', async () => {
      mockAuth.resendSignupCode.mockResolvedValue(ok)
      render(<Verify />)
      type('000000')
      await act(async () => {})
      expect(screen.getByText(/That code didn't work/)).toBeTruthy()
      tick(60)
      await act(async () => fireEvent.press(screen.getByTestId('resend-code')))
      expect(screen.queryByText(/That code didn't work/)).toBeNull()
    })
  })
})

describe('Forgot password, edge input', () => {
  it.each([['empty', ''], ['whitespace only', '   ']])('an %s email is refused with no request', (_l, email) => {
    render(<ForgotPassword />)
    fireEvent.changeText(screen.getByLabelText('Email'), email)
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Type the email you sign in with.')).toBeTruthy()
    expect(mockAuth.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('sends the trimmed email and carries it to the next step', async () => {
    mockAuth.sendPasswordReset.mockResolvedValue(ok)
    render(<ForgotPassword />)
    fireEvent.changeText(screen.getByLabelText('Email'), '  sam+tag@example.com  ')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/reset-password', params: { email: 'sam+tag@example.com' } })
    )
    expect(mockAuth.sendPasswordReset).toHaveBeenCalledWith('sam+tag@example.com')
  })

  it('stops, with the sentence, when rate limited', async () => {
    mockAuth.sendPasswordReset.mockResolvedValue({ problem: problem('rate-limited') })
    mockParams = { email: 'who@example.com' }
    render(<ForgotPassword />)
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([['a malformed email', 'bad-email'], ['an unknown server failure', 'unreachable']] as const)(
    'moves on after %s too, so the form never reveals which emails exist',
    async (_l, kind) => {
      mockAuth.sendPasswordReset.mockResolvedValue({ problem: { kind, message: 'x' } })
      mockParams = { email: 'who@example.com' }
      render(<ForgotPassword />)
      fireEvent.press(screen.getByTestId('auth-submit'))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
    }
  )

  it('a second return key while the code is being sent sends one email', async () => {
    const slow = pending<typeof ok>()
    mockAuth.sendPasswordReset.mockReturnValue(slow.promise)
    mockParams = { email: 'who@example.com' }
    render(<ForgotPassword />)
    fireEvent(screen.getByLabelText('Email'), 'submitEditing')
    fireEvent(screen.getByLabelText('Email'), 'submitEditing')
    await act(async () => slow.resolve(ok))
    expect(mockAuth.sendPasswordReset).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})

describe('Reset password', () => {
  beforeEach(() => {
    mockParams = { email: 'sam@example.com' }
  })
  const fill = (code: string, password: string) => {
    fireEvent.changeText(screen.getByTestId('code-input'), code)
    fireEvent.changeText(screen.getByLabelText('New password'), password)
  }

  it.each(['', '12345', 'abcdef', '12 34'])('refuses the code %j before spending it', (code) => {
    render(<ResetPassword />)
    fill(code, 'newsecret')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Type the 6-digit code from the email.')).toBeTruthy()
    expect(mockAuth.resetPassword).not.toHaveBeenCalled()
  })

  it('refuses a short new password before the code is spent', () => {
    render(<ResetPassword />)
    fill('123456', '12345')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(screen.getByText('Use at least 6 characters for the password.')).toBeTruthy()
    expect(mockAuth.resetPassword).not.toHaveBeenCalled()
  })

  it('strips letters and spaces from a pasted code, then saves with its six digits', async () => {
    mockAuth.resetPassword.mockResolvedValue(ok)
    render(<ResetPassword />)
    fill('12 34-56', 'new secret!')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockAuth.resetPassword).toHaveBeenCalledWith('sam@example.com', '123456', 'new secret!'))
  })

  it('a pasted code longer than six is cut to six, not refused', async () => {
    mockAuth.resetPassword.mockResolvedValue(ok)
    render(<ResetPassword />)
    fill('1234567', 'newsecret')
    fireEvent.press(screen.getByTestId('auth-submit'))
    await waitFor(() => expect(mockAuth.resetPassword).toHaveBeenCalledWith('sam@example.com', '123456', 'newsecret'))
  })

  it('does not cap the code field below a pasted "123 456"', () => {
    render(<ResetPassword />)
    expect(screen.getByTestId('code-input').props.maxLength).toBeUndefined()
  })

  it('a wrong code says so and keeps the password the person typed', async () => {
    mockAuth.resetPassword.mockResolvedValue({ problem: problem('bad-code') })
    render(<ResetPassword />)
    fill('000000', 'newsecret')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText(/That code didn't work/)).toBeTruthy()
    expect(screen.getByLabelText('New password').props.value).toBe('newsecret')
  })

  it('a password Supabase finds too weak is explained', async () => {
    mockAuth.resetPassword.mockResolvedValue({ problem: problem('weak-password') })
    render(<ResetPassword />)
    fill('123456', 'password')
    fireEvent.press(screen.getByTestId('auth-submit'))
    expect(await screen.findByText(/too weak/)).toBeTruthy()
  })

  it('a second return key while saving sends one reset', async () => {
    const slow = pending<typeof ok>()
    mockAuth.resetPassword.mockReturnValue(slow.promise)
    render(<ResetPassword />)
    fill('123456', 'newsecret')
    fireEvent(screen.getByLabelText('New password'), 'submitEditing')
    fireEvent(screen.getByLabelText('New password'), 'submitEditing')
    await act(async () => slow.resolve(ok))
    expect(mockAuth.resetPassword).toHaveBeenCalledTimes(1)
  })

  it('Send again asks for a fresh code and says it was sent', async () => {
    mockAuth.sendPasswordReset.mockResolvedValue(ok)
    render(<ResetPassword />)
    fireEvent.press(screen.getByText('Send again'))
    expect(await screen.findByText('Sent. Check your email.')).toBeTruthy()
    expect(mockAuth.sendPasswordReset).toHaveBeenCalledWith('sam@example.com')
  })

  it.each(['offline', 'rate-limited'] as const)('Send again, when %s, shows why and does not claim it sent', async (kind) => {
    mockAuth.sendPasswordReset.mockResolvedValue({ problem: problem(kind) })
    render(<ResetPassword />)
    fireEvent.press(screen.getByText('Send again'))
    expect(await screen.findByText(problem(kind).message)).toBeTruthy()
    expect(screen.queryByText('Sent. Check your email.')).toBeNull()
  })
})
