'use client'
import { Suspense, useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authPath, landingAfterSignIn } from '@/lib/auth-landing'
import { toProblem, type AuthProblem } from '@splat-connect/types'
import Link from 'next/link'
import type { Route } from 'next'
import { AuthError, AuthStage } from '@/components/auth-shell'

function LoginForm() {
  const supabase = createClient()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<AuthProblem | null>(null)
  const [codeLink, setCodeLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCodeLink(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const found = toProblem(error)!
        if (found.kind === 'credentials') setPassword('')
        if (found.kind === 'unconfirmed') {
          // An account from before codes existed may never have confirmed:
          // send a fresh code so the next screen can take it straight away.
          const resent = await supabase.auth.resend({ type: 'signup', email })
          if (resent.error) {
            setError(toProblem(resent.error))
            return
          }
          setCodeLink(authPath('/login/verify', { email, type: 'signup', next }))
        }
        setError(found)
        return
      }
      // A full reload, not router.push: the server re-renders the root layout
      // with the new session, so the nav shows the signed-in state at once.
      window.location.href = await landingAfterSignIn(supabase, next)
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
          <p className="mt-2 text-right text-[13px]">
            <Link href={authPath('/login/forgot', { email, next }) as Route} className="auth-card__link">
              Forgot password?
            </Link>
          </p>
        </div>
        <AuthError error={error} action={codeLink ? { label: 'Enter the code', href: codeLink } : undefined} />
        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-card__alt">
        <Link href={authPath('/login/code', { email, next }) as Route} className="auth-card__link">
          Email me a sign-in code
        </Link>
      </p>
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
