import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AGREEMENT_VERSIONS, hasCurrentAgreement, type Profile, type UserAgreement } from '@splat-connect/types'
import { supabase } from './supabase'
import { apiClient } from './api-client'
import { problem, toProblem, type AuthProblem } from './auth-errors'
import { appleCredential, googleIdToken, googleSavedIdToken, googleSignOut, type SocialResult } from './social-auth'
import { setRecentsOwner } from './recents'
import { setTicksOwner } from './guide-progress'

/** `problem` null means it worked. `cancelled`: the person closed Apple's or
 *  Google's sheet — the screens show nothing for it. */
export type AuthResult = { problem: AuthProblem | null; cancelled?: boolean }

const ok: AuthResult = { problem: null }
const result = (error: Parameters<typeof toProblem>[0]): AuthResult => ({ problem: toProblem(error) })

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  // null = not yet determined (initial mount, or a session just changed and the
  // agreements fetch hasn't landed). Only `false` means the server confirmed no
  // acceptance — the profile-tab gate must key off that exact distinction, or it
  // flashes for every already-accepted user on every launch.
  hasContributorTerms: boolean | null
  /** Apple's full name from a first sign-in, for the terms gate's name field. */
  pendingName: string | null
  /** True while a password reset is between verifying its code (which signs
   *  you in) and saving the new password — (auth)/_layout holds its redirect. */
  resetting: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>
  verifyCode: (email: string, token: string, type: 'signup' | 'email') => Promise<AuthResult>
  resendSignupCode: (email: string) => Promise<AuthResult>
  sendSignInCode: (email: string) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  resetPassword: (email: string, token: string, password: string) => Promise<AuthResult>
  signInWithApple: () => Promise<AuthResult>
  /** Apple's sheet again, for account deletion: a fresh sign-in plus the
   *  authorization code the API revokes the grant with. */
  reauthWithApple: () => Promise<AuthResult & { authorizationCode?: string }>
  signInWithGoogle: () => Promise<AuthResult>
  /** android-one-tap: a saved Google account, silently. Null when there was none to offer. */
  signInWithSavedGoogle: () => Promise<AuthResult | null>
  setProfileName: (name: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  acceptContributorTerms: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasContributorTerms, setHasContributorTerms] = useState<boolean | null>(null)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    // A failed read (the secure store refusing) is "signed out", not a spinner forever.
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // "Pick up where you left off" keeps one list per account.
  useEffect(() => {
    setRecentsOwner(session?.user?.id ?? null)
    setTicksOwner(session?.user?.id ?? null)
  }, [session?.user?.id])

  // Session carries no role; the profile (with role) and the agreement rows both come
  // from the API. One effect, not two: separate fetches would give two loading states
  // that can disagree, and the terms guard would flicker between them.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      // null, not false: signing out makes this "unknown again", not "known
      // unaccepted". A later sign-in re-runs this effect and re-fetches; if this
      // were `false` in the meantime, the profile gate would flash for a signed
      // back in, already-accepted user for the same reason this whole flag was
      // widened to three states.
      setHasContributorTerms(null)
      return
    }
    let ignore = false
    Promise.all([
      apiClient.get<Profile>('/api/contributors/me').catch(() => null),
      // A failed fetch is "unknown" (null), not "not accepted": the terms gate
      // guards every signed-in route, and a network blip must not send an
      // accepted account to it.
      apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => null),
    ]).then(([p, rows]) => {
      if (ignore) return
      setProfile(p)
      setHasContributorTerms(rows ? hasCurrentAgreement(rows, 'contributor_terms') : null)
    })
    return () => { ignore = true }
  }, [session?.user?.id])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    const res = result(error)
    // An account from before codes existed may never have confirmed: send a
    // fresh code so the screen can move straight to entering it.
    if (res.problem?.kind === 'unconfirmed') await supabase.auth.resend({ type: 'signup', email })
    return res
  }

  async function signUp(email: string, password: string, name: string) {
    const web = process.env.EXPO_PUBLIC_WEB_URL
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        // Only the email's link uses this; the app itself takes the code.
        // Supabase's WAF answers an http (raw-IP dev) redirect with an HTML
        // 403 that supabase-js can't parse, so only https is ever sent.
        ...(web?.startsWith('https://') ? { emailRedirectTo: `${web}/auth/confirmed` } : {}),
      },
    })
    if (error) return result(error)
    // Supabase answers an already-registered email with a 200 and an empty
    // identities array (anti-enumeration), creating nothing — say so ourselves.
    if (data.user?.identities?.length === 0) return { problem: problem('registered') }
    return ok
  }

  async function verifyCode(email: string, token: string, type: 'signup' | 'email') {
    const { error } = await supabase.auth.verifyOtp({ email, token, type })
    return result(error)
  }

  async function resendSignupCode(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return result(error)
  }

  async function sendSignInCode(email: string) {
    // Sign-in only: an unknown email is refused rather than made an account.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    return result(error)
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return result(error)
  }

  async function resetPassword(email: string, token: string, password: string) {
    setResetting(true)
    try {
      const verified = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
      if (verified.error) return result(verified.error)
      const { error } = await supabase.auth.updateUser({ password })
      return result(error)
    } finally {
      setResetting(false)
    }
  }

  async function withIdToken(provider: 'apple' | 'google', got: SocialResult<string>): Promise<AuthResult> {
    if ('cancelled' in got) return { problem: null, cancelled: true }
    const name = provider === 'apple' ? 'Apple' : 'Google'
    const failed = { problem: { kind: 'other' as const, message: `Couldn't sign in with ${name}. Try again, or use your email.` } }
    if ('failed' in got) return failed
    const { error } = await supabase.auth.signInWithIdToken({ provider, token: got.ok })
    if (!error) return ok
    const res = result(error)
    return res.problem?.kind === 'offline' || res.problem?.kind === 'rate-limited' ? res : failed
  }

  async function signInWithApple() {
    const got = await appleCredential()
    if ('ok' in got && got.ok.fullName) setPendingName(got.ok.fullName)
    return withIdToken('apple', 'ok' in got ? { ok: got.ok.idToken } : got)
  }

  async function reauthWithApple() {
    const got = await appleCredential()
    const res = await withIdToken('apple', 'ok' in got ? { ok: got.ok.idToken } : got)
    return 'ok' in got && !res.problem ? { ...res, authorizationCode: got.ok.authorizationCode ?? undefined } : res
  }

  async function signInWithGoogle() {
    return withIdToken('google', await googleIdToken())
  }

  async function signInWithSavedGoogle(): Promise<AuthResult | null> {
    const token = await googleSavedIdToken()
    return token ? withIdToken('google', { ok: token }) : null
  }

  async function setProfileName(name: string) {
    try {
      const p = await apiClient.patch<Profile>('/api/contributors/me', { name })
      setProfile(p)
      setPendingName(null)
      return ok
    } catch {
      return { problem: { kind: 'other' as const, message: 'Could not save your name. Please try again.' } }
    }
  }

  async function signOut() {
    await Promise.all([supabase.auth.signOut(), googleSignOut()])
  }

  // Only flips the flag when the server confirms. Reporting an acceptance the server
  // never recorded would leave the user facing a 403 they cannot explain — the same
  // rule the web TermsGate follows.
  async function acceptContributorTerms() {
    try {
      await apiClient.post('/api/agreements', { agreement_type: 'contributor_terms' })
      setHasContributorTerms(true)
      return { error: null }
    } catch {
      return { error: 'Could not record your acceptance. Please try again.' }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session, profile, loading, hasContributorTerms, pendingName, resetting,
        signIn, signUp, verifyCode, resendSignupCode, sendSignInCode, sendPasswordReset, resetPassword,
        signInWithApple, reauthWithApple, signInWithGoogle, signInWithSavedGoogle, setProfileName, signOut, acceptContributorTerms,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
