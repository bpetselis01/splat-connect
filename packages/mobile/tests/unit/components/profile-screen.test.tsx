import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { ProfileScreen } from '../../../components/profile-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: null, loading: false, save: jest.fn(), saveState: 'idle' }),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ProfileScreen', () => {
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

  it('shows the account segment by default, with no role label', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Open Web Dashboard')).toBeTruthy()
    expect(screen.queryByText('Contributor')).toBeNull()
  })

  it('switches to the child profile segment on tap', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('Child Profile'))

    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.queryByText('Open Web Dashboard')).toBeNull()
  })

  it('reaches the child profile segment even when contributor terms are unaccepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn(),
    })
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('Child Profile'))

    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.queryByText('Before you continue')).toBeNull()
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
  })

  it('does not show the catch-up gate while hasContributorTerms is still null (unknown)', () => {
    // null means "the /api/agreements/me fetch hasn't resolved yet", not "the
    // server confirmed no acceptance". Treating it as unaccepted flashed this gate
    // for every already-accepted user on every launch.
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: null,
      acceptContributorTerms: jest.fn(),
    })
    render(<ProfileScreen />)

    expect(screen.queryByText('Before you continue')).toBeNull()
    expect(screen.getByText('Signed in as parent@example.com')).toBeTruthy()
  })

  it('lets the user sign out from the catch-up gate', () => {
    // Otherwise a user whose acceptance POST keeps failing (offline, API down)
    // has no reachable Sign Out button at all — the signed-in view sits behind
    // this gate's early return.
    const signOut = jest.fn()
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut,
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn().mockResolvedValue({ error: null }),
    })
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('Sign Out'))
    expect(signOut).toHaveBeenCalled()
  })

  it('links the gate checkbox label to the contributor terms page', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn().mockResolvedValue({ error: null }),
    })
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('contributor terms'))
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/legal/contributor-terms'))
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
