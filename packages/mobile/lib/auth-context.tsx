import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AGREEMENT_VERSIONS, type Profile, type UserAgreement } from '@splat-connect/types'
import { supabase } from './supabase'
import { apiClient } from './api-client'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  // null = not yet determined (initial mount, or a session just changed and the
  // agreements fetch hasn't landed). Only `false` means the server confirmed no
  // acceptance — the profile-tab gate must key off that exact distinction, or it
  // flashes for every already-accepted user on every launch.
  hasContributorTerms: boolean | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  acceptContributorTerms: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasContributorTerms, setHasContributorTerms] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

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
      apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
    ]).then(([p, rows]) => {
      if (ignore) return
      setProfile(p)
      setHasContributorTerms(rows.some((r) => r.agreement_type === 'contributor_terms'))
    })
    return () => { ignore = true }
  }, [session?.user?.id])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
    if (error) return { error: error.message }
    // Supabase returns a 200 with no error but an empty identities array when the
    // email is already registered (anti-enumeration behavior) — no account is
    // created or changed, so surface this as an error ourselves.
    if (data.user?.identities?.length === 0) {
      return { error: 'This email is already registered. Try signing in instead.' }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
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
      value={{ session, profile, loading, hasContributorTerms, signIn, signUp, signOut, acceptContributorTerms }}
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
