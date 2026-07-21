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

  it('shows an error message when sign-in fails', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signOut: jest.fn() })
    render(<ProfileScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong')
    fireEvent.press(screen.getByText('Sign In'))
    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy())
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'wrong')
  })
})
