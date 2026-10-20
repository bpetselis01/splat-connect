'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { toProblem, type AuthProblem } from '@splat-connect/types'
import { createClient } from '@/lib/supabase/client'
import { authPath } from '@/lib/auth-landing'
import { AuthError, AuthStage } from '@/components/auth-shell'

// Step one of a reset. The answer is the same whether or not an account uses
// the email, so the form reveals nothing; only being offline or rate limited
// stops it.
function ForgotForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    const address = email.trim()
    if (!address) return setError({ kind: 'other', message: 'Type the email you sign in with.' })
    setBusy(true)
    const { error: failure } = await supabase.auth.resetPasswordForEmail(address)
    setBusy(false)
    const found = toProblem(failure)
    if (found?.kind === 'offline' || found?.kind === 'rate-limited') return setError(found)
    router.push(authPath('/login/reset', { email: address, next }) as Route)
  }

  return (
    <AuthStage>
      <h1 className="auth-card__title">Forgot your password?</h1>
      <p className="auth-card__lede">
        We&apos;ll email you a 6-digit code. You&apos;ll choose a new password on the next screen.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input auth-input--sunk"
          />
        </div>
        <AuthError error={error} />
        <button type="submit" disabled={busy} className="auth-submit">
          {busy ? 'Sending…' : 'Send code'}
        </button>
      </form>
    </AuthStage>
  )
}

// useSearchParams() needs a Suspense boundary for `next build` to prerender.
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  )
}
