'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toProblem, type AuthProblem } from '@splat-connect/types'
import { createClient } from '@/lib/supabase/client'
import { landingAfterSignIn } from '@/lib/auth-landing'
import { AuthError, AuthStage, CodeInput } from '@/components/auth-shell'

// Step two: the emailed code and the new password together. For an account
// made with Google or a code this ADDS a password; the code already proves the
// email is theirs.
function ResetForm() {
  const supabase = createClient()
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  const next = params.get('next')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  // True once verifyOtp has spent the code: the session exists, so a failed
  // updateUser is retried alone, not with a code that no longer works.
  const [verified, setVerified] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!verified && code.length !== 6) {
      return setError({ kind: 'other', message: 'Type the 6-digit code from the email.' })
    }
    // Checked before the code is spent: verifying signs you in, and the new
    // password is set after, so a too-short one would be refused too late.
    if (password.length < 6) {
      return setError({ kind: 'other', message: 'Use at least 6 characters for the password.' })
    }
    setBusy(true)
    try {
      if (!verified) {
        const { error: failure } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
        if (failure) return setError(toProblem(failure))
        setVerified(true)
      }
      const { error: failure } = await supabase.auth.updateUser({ password })
      if (failure) {
        const found = toProblem(failure)!
        return setError(
          found.kind === 'weak-password' || found.kind === 'long-password' || found.kind === 'offline' || found.kind === 'rate-limited'
            ? found
            : { kind: 'other', message: 'Your code worked but the password did not save. Try the password again.' }
        )
      }
      window.location.href = await landingAfterSignIn(supabase, next)
    } finally {
      setBusy(false)
    }
  }

  async function again() {
    setError(null)
    const { error: failure } = await supabase.auth.resetPasswordForEmail(email)
    const found = toProblem(failure)
    if (found?.kind === 'offline' || found?.kind === 'rate-limited') return setError(found)
    setSent(true)
  }

  const badCode = error?.kind === 'bad-code' ? error : null

  return (
    <AuthStage>
      <h1 className="auth-card__title">Choose a new password</h1>
      <p className="auth-card__lede">
        If an account uses <strong className="text-ink">{email}</strong>, a 6-digit code is on its way.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <CodeInput value={code} onChange={setCode} disabled={busy || verified} error={badCode} />
        <div>
          <label htmlFor="password" className="auth-label">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input auth-input--sunk"
          />
        </div>
        <AuthError error={badCode ? null : error} />
        <button type="submit" disabled={busy} className="auth-submit">
          {busy ? 'Saving…' : 'Save and sign in'}
        </button>
      </form>
      {verified ? null : sent ? (
        <p className="auth-card__alt" role="status">Sent. Check your email.</p>
      ) : (
        <p className="auth-card__alt">
          Didn&apos;t get it?{' '}
          <button type="button" onClick={again} className="auth-card__link">Send again</button>
        </p>
      )}
    </AuthStage>
  )
}

// useSearchParams() needs a Suspense boundary for `next build` to prerender.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
