'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { toProblem, type AuthProblem } from '@splat-connect/types'
import { createClient } from '@/lib/supabase/client'
import { authPath } from '@/lib/auth-landing'
import { AuthError, AuthStage } from '@/components/auth-shell'

// Shape only; Supabase decides the rest and its answer maps to the same words.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CodeSignInForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const address = email.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!address) return setError({ kind: 'other', message: 'Add your email.' })
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      return setError({ kind: 'bad-email', message: "That email address doesn't look right." })
    }
    setBusy(true)
    // Sign-in only: an unknown email is refused rather than made an account.
    const { error: failure } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } })
    setBusy(false)
    if (failure) return setError(toProblem(failure))
    router.push(authPath('/login/verify', { email: address, type: 'email', next }) as Route)
  }

  return (
    <AuthStage>
      <h1 className="auth-card__title">Sign in with a code</h1>
      <p className="auth-card__lede">We&apos;ll email you a 6-digit code. No password needed.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input auth-input--sunk"
          />
        </div>
        <AuthError
          error={error}
          action={error?.kind === 'no-account' ? { label: 'Create an account', href: authPath('/signup', { next }) } : undefined}
        />
        <button type="submit" disabled={busy} className="auth-submit">
          {busy ? 'Sending…' : 'Send code'}
        </button>
      </form>
      <p className="auth-card__alt">
        <Link href={authPath('/login', { next }) as Route} className="auth-card__link">
          Use a password instead
        </Link>
      </p>
    </AuthStage>
  )
}

// useSearchParams() needs a Suspense boundary for `next build` to prerender.
export default function CodeSignInPage() {
  return (
    <Suspense>
      <CodeSignInForm />
    </Suspense>
  )
}
