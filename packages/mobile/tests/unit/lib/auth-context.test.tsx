import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockSignUp = jest.fn()
const mockSignOut = jest.fn()
const mockApiGet = jest.fn()
const mockApiPost = jest.fn()

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  })

  // Tests: loading starts true and flips to false once the initial session check resolves
  it('resolves loading to false after the initial session check', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  // Tests: signIn surfaces the Supabase error message on failure
  it('signIn returns the error message on failed sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signIn('a@b.com', 'wrong'))
    expect(error).toBe('Invalid login credentials')
  })

  // Tests: signIn returns a null error on success
  it('signIn returns null error on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signIn('a@b.com', 'correct'))
    expect(error).toBeNull()
  })

  // Tests: signOut delegates to Supabase
  it('signOut calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalled()
  })

  // Tests: signUp forwards name + parent role in the user metadata
  it('signUp passes name and parent role in metadata', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
    expect(error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'p@b.com',
      password: 'pw',
      options: {
        data: { name: 'Pat', role: 'parent' },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
  })

  // Tests: Supabase returns 200 + empty identities for an already-registered email
  it('signUp reports an error when the email is already registered', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
    expect(error).toBe('This email is already registered. Try signing in instead.')
  })

  // Tests: an active session triggers a profile fetch that carries the role
  it('loads the profile (with role) when a session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([])
        : Promise.resolve({ id: 'u1', name: 'Pat', email: 'p@b.com', role: 'parent' })
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile?.role).toBe('parent'))
  })

  // Tests: no session means no profile and no fetch
  it('clears the profile when there is no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  // Tests: a failed profile fetch leaves the profile null rather than throwing
  it('leaves the profile null when the profile fetch fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
  })

  // Tests: the agreements endpoint reporting a contributor_terms row flips the flag
  it('reports contributor terms from the agreements endpoint', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([{ agreement_type: 'contributor_terms' }])
        : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.hasContributorTerms).toBe(true))
  })

  // Tests: no contributor_terms row means the flag stays false
  it('reports no contributor terms when the row is absent', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([])
        : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.profile).not.toBeNull())
    expect(result.current.hasContributorTerms).toBe(false)
  })

  // Tests: signing out (or never having signed in) leaves the flag "unknown", not
  // "known unaccepted" — false here would flash the profile gate for an
  // already-accepted user who signs out and back in within the same app session.
  it('resets contributor terms to null when there is no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasContributorTerms).toBeNull()
  })

  // Tests: the flag starts null, before the initial session check even resolves —
  // the profile gate must not treat this as "known unaccepted".
  it('starts with hasContributorTerms as null', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.hasContributorTerms).toBeNull()
  })

  // Tests: a successful POST records the acceptance and flips the flag
  it('acceptContributorTerms sets the flag after the server confirms', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me' ? Promise.resolve([]) : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )
    mockApiPost.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    expect(result.current.hasContributorTerms).toBe(false)

    const { error } = await act(() => result.current.acceptContributorTerms())

    expect(error).toBeNull()
    expect(mockApiPost).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'contributor_terms' })
    expect(result.current.hasContributorTerms).toBe(true)
  })

  // Tests: a failed POST returns an error and never reports an unrecorded acceptance
  it('acceptContributorTerms leaves the flag false when the server rejects', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me' ? Promise.resolve([]) : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )
    mockApiPost.mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile).not.toBeNull())

    const { error } = await act(() => result.current.acceptContributorTerms())

    expect(error).toBe('Could not record your acceptance. Please try again.')
    expect(result.current.hasContributorTerms).toBe(false)
  })
})
