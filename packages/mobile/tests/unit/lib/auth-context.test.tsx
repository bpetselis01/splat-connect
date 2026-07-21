import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockSignOut = jest.fn()

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
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
})
