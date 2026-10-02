'use client'
import { Suspense, useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sanitiseNextPath } from '@/lib/safe-next-path'
import { pendingIntent, type SignupIntent } from '@splat-connect/types'

/** Where the sign-up tile lands someone the first time they sign in. */
const INTENT_LANDING: Record<SignupIntent, string> = {
  family: '/onboarding/child',
  maker: '/dashboard/tutorials',
}
import Link from 'next/link'
import type { Route } from 'next'
import { AuthStage } from '@/components/auth-shell'

function LoginForm() {
  const supabase = createClient()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      // WHY: router.refresh() + router.push() left the nav showing the logged-out state
      //      because router.refresh() is not awaitable — the push fires before the
      //      server re-renders the layout with the new auth session.
      // HOW: window.location.href forces a full page reload, so the server always
      //      runs the root layout fresh and the nav reflects the correct role immediately.
      // Everyone shares one dashboard; only the admin area is separate. The
      // role column no longer decides what a user may do, so it no longer
      // decides where they land.
      // `next` is only honoured once sanitiseNextPath has confirmed it is a
      // same-origin path — see lib/safe-next-path.ts for why that check
      // exists. Absent or rejected, it falls back to the role-based default.
      const fallback = profile?.role === 'admin' ? '/admin' : '/dashboard'
      // The sign-up tile decides the first landing only. It is spent here
      // whichever way this sign-in goes, so a ?next= detour (a save, a
      // download) does not leave it to hijack some later sign-in instead.
      const intent = pendingIntent(user!.user_metadata)
      if (intent) await supabase.auth.updateUser({ data: { intent_landed: true } })
      window.location.href =
        sanitiseNextPath(next) ?? (intent ? INTENT_LANDING[intent] : fallback)
    } finally {
      setLoading(false)
    }
  }

  const query = params.toString()

  // The board's centred stage, not Create account's two-column page: signing
  // in is one card with a way across to signup under it. ?next= rides along
  // on that link, so someone sent here to save something who has no account
  // yet still comes back to it.
  return (
    <AuthStage>
      <h1 className="auth-card__title">Sign in</h1>
      <p className="auth-card__lede">
        One account for everything — browse, contribute, and manage your child&apos;s profile.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input auth-input--sunk"
          />
        </div>
        <div>
          <label htmlFor="password" className="auth-label">Password</label>
          <div className="auth-password">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input auth-input--sunk"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-card__alt">
        No account yet?{' '}
        <Link href={`/signup${query ? `?${query}` : ''}` as Route} className="auth-card__link">
          Create one
        </Link>
      </p>
    </AuthStage>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page (it can't statically render something that reads the
// query string) — same reasoning as app/onboarding/contributor-terms/page.tsx.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
