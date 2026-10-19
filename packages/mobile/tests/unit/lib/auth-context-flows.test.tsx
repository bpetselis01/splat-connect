// The auth provider's session lifecycle and the less-travelled transactions:
// expiry, a switch of account, a slow fetch landing after sign-out, reset's
// "resetting" hold, social sign-in failures and a rejected save.
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignUp = jest.fn()
const mockSignOut = jest.fn()
const mockApiGet = jest.fn()
const mockApiPost = jest.fn()
const mockApiPatch = jest.fn()
const mockVerifyOtp = jest.fn()
const mockResend = jest.fn()
const mockResetPasswordForEmail = jest.fn()
const mockUpdateUser = jest.fn()
const mockSignInWithIdToken = jest.fn()
const mockAppleCredential = jest.fn()
const mockGoogleIdToken = jest.fn()
const mockGoogleSignOut = jest.fn()
const mockUnsubscribe = jest.fn()

jest.mock('../../../lib/social-auth', () => ({
  appleCredential: () => mockAppleCredential(),
  googleIdToken: () => mockGoogleIdToken(),
  googleSavedIdToken: () => Promise.resolve(null),
  googleSignOut: () => mockGoogleSignOut(),
}))
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      onAuthStateChange: (...a: unknown[]) => mockOnAuthStateChange(...a),
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
      verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
      resend: (...a: unknown[]) => mockResend(...a),
      resetPasswordForEmail: (...a: unknown[]) => mockResetPasswordForEmail(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
      signInWithIdToken: (...a: unknown[]) => mockSignInWithIdToken(...a),
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

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const sessionFor = (id: string, token = 't') => ({ access_token: token, user: { id } })

let emit: (event: string, session: unknown) => void

function serve(profiles: Record<string, unknown>, accepted = true) {
  mockApiGet.mockImplementation((path: string) => {
    if (path === '/api/agreements/me') return Promise.resolve(accepted ? [{ agreement_type: 'contributor_terms', version: 'v0-todo' }] : [])
    if (path === '/api/contributors/me') return Promise.resolve(profiles.current)
    return Promise.reject(new Error(`unexpected ${path}`))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockImplementation((cb: typeof emit) => {
    emit = cb
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
  })
})

describe('session lifecycle', () => {
  it('an expired session ends the signed-in state: no session, no profile, terms unknown', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    serve({ current: { id: 'u1', name: 'Ada' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.hasContributorTerms).toBe(true))
    expect(result.current.profile?.name).toBe('Ada')

    act(() => emit('SIGNED_OUT', null))

    expect(result.current.session).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(result.current.hasContributorTerms).toBeNull()
  })

  it('a token refresh for the same account does not refetch the profile', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1', 'old') } })
    serve({ current: { id: 'u1', name: 'Ada' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    mockApiGet.mockClear()

    act(() => emit('TOKEN_REFRESHED', sessionFor('u1', 'new')))

    expect(result.current.session?.access_token).toBe('new')
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  it('a different account signing in loads its own profile and terms', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    serve({ current: { id: 'u1', name: 'Ada' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile?.name).toBe('Ada'))

    serve({ current: { id: 'u2', name: 'Bo' } }, false)
    act(() => emit('SIGNED_IN', sessionFor('u2')))

    await waitFor(() => expect(result.current.profile?.name).toBe('Bo'))
    expect(result.current.hasContributorTerms).toBe(false)
  })

  it('a slow profile fetch that lands after sign-out is dropped', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    let land!: (p: unknown) => void
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me' ? Promise.resolve([{ agreement_type: 'contributor_terms', version: 'v0-todo' }]) : new Promise((r) => (land = r))
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2))

    act(() => emit('SIGNED_OUT', null))
    await act(async () => land({ id: 'u1', name: 'Ada' }))

    expect(result.current.profile).toBeNull()
    expect(result.current.hasContributorTerms).toBeNull()
  })

  it('stops listening when the provider unmounts', async () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper })
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('an account with no terms row but a profile is "not accepted", not "unknown"', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    serve({ current: { id: 'u1', name: 'Ada' } }, false)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.hasContributorTerms).toBe(false))
  })

  it('only the contributor_terms row counts as acceptance', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    mockApiGet.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/agreements/me' ? [{ agreement_type: 'something_else' }] : { id: 'u1' })
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.hasContributorTerms).toBe(false))
  })

  it('a profile fetch that fails while the agreements fetch works still records acceptance', async () => {
    mockGetSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/agreements/me' ? Promise.resolve([{ agreement_type: 'contributor_terms', version: 'v0-todo' }]) : Promise.reject(new Error('500'))
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.hasContributorTerms).toBe(true))
    expect(result.current.profile).toBeNull()
  })
})

describe('password reset', () => {
  it('holds "resetting" from the code check until the new password is saved, then lets go', async () => {
    let finishUpdate!: (v: unknown) => void
    mockVerifyOtp.mockResolvedValue({ error: null })
    mockUpdateUser.mockReturnValue(new Promise((r) => (finishUpdate = r)))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.resetting).toBe(false)

    let done!: Promise<unknown>
    act(() => {
      done = result.current.resetPassword('a@b.com', '123456', 'newsecret')
    })
    await waitFor(() => expect(result.current.resetting).toBe(true))
    await act(async () => {
      finishUpdate({ error: null })
      await done
    })
    expect(result.current.resetting).toBe(false)
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'recovery' })
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newsecret' })
  })

  it('lets go of "resetting" when the code is wrong', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.resetPassword('a@b.com', '000000', 'newsecret'))
    expect(result.current.resetting).toBe(false)
  })

  it('lets go of "resetting" even if the request throws', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.resetPassword('a@b.com', '123456', 'newsecret').catch(() => {})
    })
    expect(result.current.resetting).toBe(false)
  })

  it('a code that works but a password Supabase refuses is a weak-password problem, not a success', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: { code: 'weak_password', message: 'Password should be at least 6 characters.' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.resetPassword('a@b.com', '123456', 'abc'))
    expect(res.problem?.kind).toBe('weak-password')
    expect(result.current.resetting).toBe(false)
  })

  it('sendPasswordReset sends the email as given and maps a rate limit', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { status: 429, message: 'x' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.sendPasswordReset('sam+tag@example.com'))
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('sam+tag@example.com')
    expect(res.problem?.kind).toBe('rate-limited')
  })
})

describe('sign-up, resend and verify', () => {
  it('passes a name with quotes, markup and emoji to Supabase exactly as typed', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const name = `Zoë "<b>O'Brien</b>" 🧸 & سارة`
    await act(() => result.current.signUp('a@b.com', 'pw', name))
    expect(mockSignUp.mock.calls[0][0].options.data.name).toBe(name)
  })

  it('an answer with no identities field at all is a new account, not "already registered"', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await act(() => result.current.signUp('a@b.com', 'pw', 'Pat'))).problem).toBeNull()
  })

  it('a refused password is a weak-password problem and creates nothing to confirm', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { code: 'weak_password', status: 422, message: 'Password should be at least 6 characters.' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await act(() => result.current.signUp('a@b.com', 'abc', 'Pat'))).problem?.kind).toBe('weak-password')
  })

  it.each([
    ['over_email_send_rate_limit', 'rate-limited'],
    ['email_address_invalid', 'bad-email'],
  ])('resendSignupCode maps %s to %s', async (code, kind) => {
    mockResend.mockResolvedValue({ error: { code, message: code } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await act(() => result.current.resendSignupCode('a@b.com'))).problem?.kind).toBe(kind)
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' })
  })

  it('verifyCode maps an expired code to the bad-code sentence and an offline call to offline', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    mockVerifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } })
    expect((await act(() => result.current.verifyCode('a@b.com', '123456', 'signup'))).problem?.kind).toBe('bad-code')
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'Network request failed' } })
    expect((await act(() => result.current.verifyCode('a@b.com', '123456', 'signup'))).problem?.kind).toBe('offline')
  })
})

describe('social sign-in failures', () => {
  it.each([
    ['offline', { message: 'Network request failed' }],
    ['rate-limited', { status: 429, message: 'x' }],
  ])('a Google token Supabase answers with %s keeps that sentence', async (kind, error) => {
    mockGoogleIdToken.mockResolvedValue({ ok: 'jwt' })
    mockSignInWithIdToken.mockResolvedValue({ error })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await act(() => result.current.signInWithGoogle())).problem?.kind).toBe(kind)
  })

  it('a Google token Supabase refuses for any other reason is the generic sentence, never Supabase\'s words', async () => {
    mockGoogleIdToken.mockResolvedValue({ ok: 'jwt' })
    mockSignInWithIdToken.mockResolvedValue({ error: { code: 'bad_jwt', message: 'Unacceptable audience in id_token' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithGoogle())
    expect(res.problem?.message).toBe("Couldn't sign in with Google. Try again, or use your email.")
  })

  it('Apple with no full name leaves the pending name empty', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: null, authorizationCode: 'c' } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithApple())
    expect(result.current.pendingName).toBeNull()
  })

  it('a cancelled Apple sheet is not a problem and does not call Supabase', async () => {
    mockAppleCredential.mockResolvedValue({ cancelled: true })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(await act(() => result.current.signInWithApple())).toEqual({ problem: null, cancelled: true })
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })

  it('an Apple failure says so in words naming Apple', async () => {
    mockAppleCredential.mockResolvedValue({ failed: 'Apple returned no identity token.' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await act(() => result.current.signInWithApple())).problem?.message).toBe(
      "Couldn't sign in with Apple. Try again, or use your email."
    )
  })

  it('re-authorising with Apple for deletion returns the authorization code', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: null, authorizationCode: 'auth-code' } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(await act(() => result.current.reauthWithApple())).toEqual({ problem: null, authorizationCode: 'auth-code' })
  })

  it('re-authorising with Apple returns no code when Supabase refuses the token', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: null, authorizationCode: 'auth-code' } })
    mockSignInWithIdToken.mockResolvedValue({ error: { message: 'bad' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.reauthWithApple())
    expect(res.problem).not.toBeNull()
    expect(res.authorizationCode).toBeUndefined()
  })

  it('re-authorising with Apple, when Apple gave no authorization code, still succeeds without one', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: null, authorizationCode: null } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.reauthWithApple())
    expect(res.problem).toBeNull()
    expect(res.authorizationCode).toBeUndefined()
  })
})

describe('profile name and terms writes', () => {
  it('a failed name save says so, keeps the Apple name pending and leaves the profile alone', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: 'Sam Mitchell', authorizationCode: null } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    mockApiPatch.mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithApple())
    const res = await act(() => result.current.setProfileName('Sam Mitchell'))
    expect(res.problem?.message).toBe('Could not save your name. Please try again.')
    expect(result.current.pendingName).toBe('Sam Mitchell')
    expect(result.current.profile).toBeNull()
  })

  it('a saved name clears the pending Apple name', async () => {
    mockAppleCredential.mockResolvedValue({ ok: { idToken: 'jwt', fullName: 'Sam Mitchell', authorizationCode: null } })
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    mockApiPatch.mockResolvedValue({ id: 'u1', name: 'Sam M' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithApple())
    await act(() => result.current.setProfileName('Sam M'))
    expect(result.current.pendingName).toBeNull()
  })

  it('sends a name with emoji and quotes to the API unchanged', async () => {
    mockApiPatch.mockResolvedValue({ id: 'u1', name: 'x' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.setProfileName(`Sam "🧸" <O'Brien>`))
    expect(mockApiPatch).toHaveBeenCalledWith('/api/contributors/me', { name: `Sam "🧸" <O'Brien>` })
  })

  it('accepting the terms twice posts twice and stays accepted', async () => {
    mockApiPost.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.acceptContributorTerms())
    await act(() => result.current.acceptContributorTerms())
    expect(result.current.hasContributorTerms).toBe(true)
  })

  it('signing out signs Supabase and Google out, and a Google failure does not stop it', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    mockGoogleSignOut.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1)
  })
})

describe('the first session read', () => {
  it('a getSession that rejects still ends loading, signed out, instead of a blank screen forever', async () => {
    mockGetSession.mockRejectedValue(new Error('secure store unavailable'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  it('useAuth outside the provider fails loudly', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
    spy.mockRestore()
  })
})
