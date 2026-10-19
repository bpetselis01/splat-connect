// journeys: A14
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockSignUp = jest.fn()
const mockSignOut = jest.fn()
const mockApiGet = jest.fn()
const mockApiPost = jest.fn()
const mockApiPatch = jest.fn()
const mockVerifyOtp = jest.fn()
const mockResend = jest.fn()
const mockSignInWithOtp = jest.fn()
const mockResetPasswordForEmail = jest.fn()
const mockUpdateUser = jest.fn()
const mockSignInWithIdToken = jest.fn()
const mockAppleCredential = jest.fn()
const mockGoogleIdToken = jest.fn()
const mockGoogleSaved = jest.fn()
const mockGoogleSignOut = jest.fn()

jest.mock('../../../lib/social-auth', () => ({
  appleCredential: () => mockAppleCredential(),
  googleIdToken: () => mockGoogleIdToken(),
  googleSavedIdToken: () => mockGoogleSaved(),
  googleSignOut: () => mockGoogleSignOut(),
}))

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
    },
  },
}))

jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
    patch: (...a: unknown[]) => mockApiPatch(...a),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

const webUrl = process.env.EXPO_PUBLIC_WEB_URL
afterAll(() => {
  process.env.EXPO_PUBLIC_WEB_URL = webUrl
})

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
  it('signIn maps bad credentials to the spec wording', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.signIn('a@b.com', 'wrong'))
    expect(problem).toEqual({ kind: 'credentials', message: "That email and password don't match." })
  })

  it('signIn sends a fresh code when the email was never confirmed', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed', code: 'email_not_confirmed' } })
    mockResend.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.signIn('a@b.com', 'pw'))
    expect(problem?.kind).toBe('unconfirmed')
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' })
  })

  // Tests: signIn returns a null error on success
  it('signIn returns null error on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.signIn('a@b.com', 'correct'))
    expect(problem).toBeNull()
  })

  // Tests: signOut delegates to Supabase
  it('signOut calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockGoogleSignOut).toHaveBeenCalled()
  })

  // Tests: signUp forwards name and the accepted contributor terms version in user
  //        metadata, and no role — enable_confirmations leaves no session to
  //        POST /api/agreements with, so handle_new_user() records it instead.
  it('signUp passes name and contributor_terms_version in metadata', async () => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
    expect(problem).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'p@b.com',
      password: 'pw',
      options: {
        data: { name: 'Pat', contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        emailRedirectTo: 'https://splat.example/auth/confirmed',
      },
    })
  })

  // Tests: Supabase's WAF answers a raw-IP http redirect with an HTML 403,
  //        which reached the person as "JSON Parse error". The app takes the
  //        code, so a non-https web URL sends no redirect at all.
  it.each(['http://100.102.50.23:3100', '', undefined])('signUp sends no redirect for web URL %p', async (url) => {
    if (url === undefined) delete process.env.EXPO_PUBLIC_WEB_URL
    else process.env.EXPO_PUBLIC_WEB_URL = url
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
    expect(mockSignUp.mock.calls[0][0].options).not.toHaveProperty('emailRedirectTo')
  })

  // Tests: Supabase returns 200 + empty identities for an already-registered email
  it('signUp reports an error when the email is already registered', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
    expect(problem?.kind).toBe('registered')
  })

  it('sendSignInCode never creates an account', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp', code: 'otp_disabled' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.sendSignInCode('new@b.com'))
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'new@b.com', options: { shouldCreateUser: false } })
    expect(problem?.kind).toBe('no-account')
  })

  it('verifyCode passes the code type through', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.verifyCode('a@b.com', '123456', 'email'))
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' })
    expect(problem?.kind).toBe('bad-code')
  })

  it('resetPassword verifies the recovery code, then sets the password', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.resetPassword('a@b.com', '123456', 'newpass'))
    expect(problem).toBeNull()
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'recovery' })
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass' })
  })

  it('resetPassword sets no password when the code is wrong', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { code: 'otp_expired', message: 'x' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { problem } = await act(() => result.current.resetPassword('a@b.com', '000000', 'newpass'))
    expect(problem?.kind).toBe('bad-code')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('signInWithApple hands the identity token to Supabase and keeps the one-time name', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'apple-jwt', fullName: 'Sam Mitchell' } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithApple())
    expect(res.problem).toBeNull()
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-jwt' })
    expect(result.current.pendingName).toBe('Sam Mitchell')
  })

  it('a cancelled Google sheet is neither a problem nor a sign-in', async () => {
    mockGoogleIdToken.mockResolvedValue({ cancelled: true })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithGoogle())
    expect(res).toEqual({ problem: null, cancelled: true })
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })

  it('a failed Google sign-in says so in words', async () => {
    mockGoogleIdToken.mockResolvedValue({ failed: 'DEVELOPER_ERROR' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithGoogle())
    expect(res.problem?.message).toBe("Couldn't sign in with Google. Try again, or use your email.")
  })

  it('signs a saved Google account straight in (android-one-tap)', async () => {
    mockGoogleSaved.mockResolvedValue('saved-jwt')
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithSavedGoogle())
    expect(res).toEqual({ problem: null })
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'saved-jwt' })
  })

  it('does nothing when there is no saved Google account', async () => {
    mockGoogleSaved.mockResolvedValue(null)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(await act(() => result.current.signInWithSavedGoogle())).toBeNull()
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })

  it('setProfileName saves through the API and updates the profile', async () => {
    mockApiPatch.mockResolvedValue({ id: 'u1', name: 'Sam' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.setProfileName('Sam'))
    expect(res.problem).toBeNull()
    expect(mockApiPatch).toHaveBeenCalledWith('/api/contributors/me', { name: 'Sam' })
    expect(result.current.profile?.name).toBe('Sam')
  })

  it('treats a failed agreements fetch as unknown, not unaccepted', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me' ? Promise.reject(new Error('offline')) : Promise.resolve({ id: 'u1', name: 'Ada' })
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    expect(result.current.hasContributorTerms).toBeNull()
  })

  // Tests: an active session triggers a profile fetch that carries the role
  it('loads the profile (with role) when a session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([])
        : Promise.resolve({ id: 'u1', name: 'Pat', email: 'p@b.com', role: 'contributor' })
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile?.role).toBe('contributor'))
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
        ? Promise.resolve([{ agreement_type: 'contributor_terms', version: 'v0-todo' }])
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
