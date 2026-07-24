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
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
    render(<ProfileScreen />)
    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'pw123456')
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
    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() => expect(screen.getByText('Email already registered')).toBeTruthy())
  })
})
