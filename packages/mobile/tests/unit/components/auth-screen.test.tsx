import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AuthScreen } from '../../../components/auth-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

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
    expect(screen.getByText('Sign In')).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
  })

  it('never asks the visitor to sign in to do something — the app is behind sign-in', () => {
    render(<AuthScreen />)
    expect(screen.queryByText(/sign in to/i)).toBeNull()
  })

  it('shows an error message when sign-in fails', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signUp: jest.fn(), signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong')
    fireEvent.press(screen.getByText('Sign In'))
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
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'pw123456')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('p@b.com', 'pw123456', 'Pat'))
  })

  it('shows an error and does not submit when passwords do not match', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'different')
    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() => expect(screen.getByText('Passwords do not match.')).toBeTruthy())
    expect(signUp).not.toHaveBeenCalled()
  })

  it('shows a sign-up error message on failure', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: 'Email already registered' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'pw123456')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))
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
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'pw123456')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() => expect(screen.getByText('Check Your Email')).toBeTruthy())
    expect(screen.getByText(/p@b.com/)).toBeTruthy()
    expect(screen.queryByText('Sign Up')).toBeNull()
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
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'pw123456')
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() => expect(screen.getByText('Check Your Email')).toBeTruthy())
    fireEvent.press(screen.getByText('Back to sign in'))
    expect(screen.getByText('Sign In')).toBeTruthy()
  })

  it('shows a friendly warning when signing in before confirming the email', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Email not confirmed' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signUp: jest.fn(), signOut: jest.fn() })
    render(<AuthScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.press(screen.getByText('Sign In'))
    await waitFor(() =>
      expect(
        screen.getByText('Please confirm your email before signing in — check your inbox for the confirmation link.')
      ).toBeTruthy()
    )
  })

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

    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Ada')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret1')

    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() =>
      expect(screen.getByText('Please accept the contributor terms to create an account.')).toBeTruthy()
    )
    expect(signUp).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('a@b.com', 'secret1', 'Ada'))
  })
})
