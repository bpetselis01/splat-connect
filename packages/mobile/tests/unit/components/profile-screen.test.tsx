import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ProfileScreen } from '../../../components/profile-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

describe('ProfileScreen', () => {
  it('shows a sign-in form when signed out', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signOut: jest.fn() })
    render(<ProfileScreen />)
    expect(screen.getByText('Sign In')).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
  })

  it('shows signed-in state with the user email', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Signed in as parent@example.com')).toBeTruthy()
  })

  it('shows role and a dashboard link for a contributor', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Contributor')).toBeTruthy()
    expect(screen.getByText('Open Web Dashboard')).toBeTruthy()
  })

  it('shows an error message when sign-in fails', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signUp: jest.fn(), signOut: jest.fn() })
    render(<ProfileScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong')
    fireEvent.press(screen.getByText('Sign In'))
    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy())
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'wrong')
  })

  it('switches to the sign-up form and submits name/email/password as a parent', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    const acceptContributorTerms = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      acceptContributorTerms,
    })
    render(<ProfileScreen />)
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
    render(<ProfileScreen />)
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
    render(<ProfileScreen />)
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
    const acceptContributorTerms = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      acceptContributorTerms,
    })
    render(<ProfileScreen />)
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
    const acceptContributorTerms = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      acceptContributorTerms,
    })
    render(<ProfileScreen />)
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
    render(<ProfileScreen />)
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
    const acceptContributorTerms = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms,
    })
    render(<ProfileScreen />)

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
    await waitFor(() => expect(acceptContributorTerms).toHaveBeenCalled())
  })

  it('blocks the profile view when contributor terms are unaccepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn().mockResolvedValue({ error: null }),
    })
    render(<ProfileScreen />)

    expect(screen.getByText('Before you continue')).toBeTruthy()
    expect(screen.queryByText('Sign Out')).toBeNull()
  })

  it('shows the profile once terms are accepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
      acceptContributorTerms: jest.fn(),
    })
    render(<ProfileScreen />)

    expect(screen.queryByText('Before you continue')).toBeNull()
    expect(screen.getByText('Signed in as parent@example.com')).toBeTruthy()
  })
})
