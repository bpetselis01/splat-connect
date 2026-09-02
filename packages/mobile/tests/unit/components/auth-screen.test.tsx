import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AuthScreen } from '../../../components/auth-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// "Sign in" is now the heading, a tab and the submit button at once — the same
// three places web has it. Queries go by role and testID rather than text, or
// they match whichever one the tree happens to reach first.
const submit = (name: string) => screen.getByRole('button', { name })
const field = (label: string) => screen.getByLabelText(label)

function goToSignUp() {
  fireEvent.press(screen.getByTestId('auth-tab-signup'))
}

function fillSignUp({ confirm = 'pw123456' } = {}) {
  fireEvent.changeText(field('Full name'), 'Pat')
  fireEvent.changeText(field('Email'), 'p@b.com')
  fireEvent.changeText(field('Password'), 'pw123456')
  fireEvent.changeText(field('Confirm password'), confirm)
}

describe('AuthScreen', () => {
  // Every case gets a full, valid AuthContextValue so it can run alone (e.g. via
  // `jest -t`) without depending on an earlier test's mockReturnValue. Cases that
  // need something different override it inside the test body.
  beforeEach(() => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      profile: null,
      loading: false,
      hasContributorTerms: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      acceptContributorTerms: jest.fn(),
    })
  })

  it('shows a sign-in form when signed out', () => {
    render(<AuthScreen />)
    expect(submit('Sign in')).toBeTruthy()
    expect(field('Email')).toBeTruthy()
  })

  it('never asks the visitor to sign in to do something — the app is behind sign-in', () => {
    render(<AuthScreen />)
    expect(screen.queryByText(/sign in to/i)).toBeNull()
  })

  it('marks the current tab on the switch and moves between the two forms', () => {
    render(<AuthScreen />)
    expect(screen.getByTestId('auth-tab-signin')).toBeSelected()
    expect(screen.queryByLabelText('Full name')).toBeNull()

    goToSignUp()
    expect(screen.getByTestId('auth-tab-signup')).toBeSelected()
    expect(screen.getByTestId('auth-tab-signin')).not.toBeSelected()
    expect(field('Full name')).toBeTruthy()

    fireEvent.press(screen.getByTestId('auth-tab-signin'))
    expect(screen.queryByLabelText('Full name')).toBeNull()
  })

  it('shows an error message when sign-in fails', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signUp: jest.fn(), signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.changeText(field('Email'), 'a@b.com')
    fireEvent.changeText(field('Password'), 'wrong')
    fireEvent.press(submit('Sign in'))
    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy())
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'wrong')
  })

  it('switches to the sign-up form and submits name/email/password', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
    })
    render(<AuthScreen />)
    goToSignUp()
    fillSignUp()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(submit('Create account'))
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('p@b.com', 'pw123456', 'Pat'))
  })

  it('shows an error and does not submit when passwords do not match', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
    render(<AuthScreen />)
    goToSignUp()
    fillSignUp({ confirm: 'different' })
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(submit('Create account'))
    await waitFor(() => expect(screen.getByText('Passwords do not match.')).toBeTruthy())
    expect(signUp).not.toHaveBeenCalled()
  })

  it('shows a sign-up error message on failure', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: 'Email already registered' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
    render(<AuthScreen />)
    goToSignUp()
    fillSignUp()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(submit('Create account'))
    await waitFor(() => expect(screen.getByText('Email already registered')).toBeTruthy())
  })

  it('shows a check-your-email screen after a successful sign-up, with no way to resubmit', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
    })
    render(<AuthScreen />)
    goToSignUp()
    fillSignUp()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(submit('Create account'))
    await waitFor(() => expect(screen.getByText('Check your email')).toBeTruthy())
    expect(screen.getByText(/p@b.com/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull()
    expect(signUp).toHaveBeenCalledTimes(1)
  })

  it('returns to the sign-in form from the check-your-email screen', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
    })
    render(<AuthScreen />)
    goToSignUp()
    fillSignUp()
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(submit('Create account'))
    await waitFor(() => expect(screen.getByText('Check your email')).toBeTruthy())
    fireEvent.press(submit('Back to sign in'))
    expect(submit('Sign in')).toBeTruthy()
  })

  it('shows a friendly warning when signing in before confirming the email', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Email not confirmed' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signUp: jest.fn(), signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.changeText(field('Email'), 'a@b.com')
    fireEvent.changeText(field('Password'), 'pw123456')
    fireEvent.press(submit('Sign in'))
    await waitFor(() =>
      expect(
        screen.getByText('Please confirm your email before signing in — check your inbox for the confirmation link.')
      ).toBeTruthy()
    )
  })

  // Web disables the button rather than accepting the press and answering with
  // an error, so there is no longer an "accept the terms" message to assert —
  // the control itself is what says no.
  it('blocks signup until the terms box is ticked', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      hasContributorTerms: false,
    })
    render(<AuthScreen />)

    goToSignUp()
    fireEvent.changeText(field('Full name'), 'Ada')
    fireEvent.changeText(field('Email'), 'a@b.com')
    fireEvent.changeText(field('Password'), 'secret1')
    fireEvent.changeText(field('Confirm password'), 'secret1')

    expect(submit('Create account')).toBeDisabled()
    fireEvent.press(submit('Create account'))
    expect(signUp).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    expect(submit('Create account')).toBeEnabled()
    fireEvent.press(submit('Create account'))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('a@b.com', 'secret1', 'Ada'))
  })
})
