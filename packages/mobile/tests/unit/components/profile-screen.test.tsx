import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { ProfileScreen } from '../../../components/profile-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: null, loading: false, save: jest.fn(), saveState: 'idle' }),
}))

const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    post: jest.fn(),
  },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

/** The signed-in shape most tests want; override per test. */
function auth(over: object) {
  return {
    session: { user: { email: 'contributor@example.com' } },
    profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasContributorTerms: true,
    ...over,
  }
}
const mockUseAuth = useAuth as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
})

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

    // The segment now hosts the child list, whose own header line proves the
    // switch; the sub-screens moved behind each child's editor.
    expect(screen.getByText('+ Add child')).toBeTruthy()
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

    expect(screen.getByText('+ Add child')).toBeTruthy()
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

  describe('the account panel additions', () => {
    it('saves a display-name change when editing ends', async () => {
      mockUseAuth.mockReturnValue(auth({}))
      render(<ProfileScreen />)

      const field = await screen.findByLabelText('Display name')
      fireEvent(field, 'endEditing', { nativeEvent: { text: '  New Name  ' } })
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { name: 'New Name' })
      )
      expect(await screen.findByText('Saved')).toBeTruthy()
    })

    it('does not save an unchanged or empty name', async () => {
      mockUseAuth.mockReturnValue(auth({}))
      render(<ProfileScreen />)

      const field = await screen.findByLabelText('Display name')
      fireEvent(field, 'endEditing', { nativeEvent: { text: '   ' } })
      expect(mockPatch).not.toHaveBeenCalled()
    })

    it('shows when the contributor terms were accepted', async () => {
      mockUseAuth.mockReturnValue(auth({}))
      mockGet.mockResolvedValue([
        { id: 'a1', user_id: 'u1', agreement_type: 'contributor_terms', version: 'v0-todo', accepted_at: '2026-08-12T00:00:00Z' },
      ])
      render(<ProfileScreen />)

      expect(
        await screen.findByText('Contributor terms · accepted v0-todo · 12 Aug 2026')
      ).toBeTruthy()
    })
  })
})
