'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { EnvelopeOpen } from '@phosphor-icons/react/dist/ssr'
import { toProblem, type AuthProblem } from '@splat-connect/types'
import { createClient } from '@/lib/supabase/client'
import { authPath, landingAfterSignIn } from '@/lib/auth-landing'
import { AuthError, AuthStage, CodeInput } from '@/components/auth-shell'

const RESEND_AFTER = 60

// The sixth digit signs you in. Serves a sign-up confirmation (type=signup) and
// a code sign-in (type=email).
function VerifyForm() {
  const supabase = createClient()
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  const type = params.get('type') === 'email' ? 'email' : 'signup'
  const next = params.get('next')
  const [code, setCode] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [wait, setWait] = useState(RESEND_AFTER)
  // A ref, not `busy`: a second change event can land before the disabled state renders.
  const verifying = useRef(false)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function check(token: string) {
    if (verifying.current) return
    verifying.current = true
    setError(null)
    setBusy(true)
    const { error: failure } = await supabase.auth.verifyOtp({ email, token, type })
    if (failure) {
      verifying.current = false
      setBusy(false)
      setCode('')
      return setError(toProblem(failure))
    }
    window.location.href = await landingAfterSignIn(supabase, next)
  }

  function onChange(digits: string) {
    setCode(digits)
    if (digits.length === 6) void check(digits)
  }

  async function resend() {
    if (resending) return
    setError(null)
    setResending(true)
    const { error: failure } =
      type === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email })
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setResending(false)
    if (failure) return setError(toProblem(failure))
    setWait(RESEND_AFTER)
  }

  const changeEmail = type === 'email' ? authPath('/login/code', { email, next }) : authPath('/signup', { next })

  return (
    <AuthStage>
      <div className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="auth-sent__badge">
          <EnvelopeOpen weight="fill" />
        </span>
        <h1 className="auth-sent__title">Check your email</h1>
        <p className="auth-sent__body">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <CodeInput value={code} onChange={onChange} disabled={busy} error={error?.kind === 'bad-code' ? error : null} />
        <AuthError error={error?.kind === 'bad-code' ? null : error} />
        {busy ? <p className="auth-card__alt" role="status">Checking…</p> : null}
        <p className="auth-card__alt">
          {wait > 0 ? (
            <>Resend code in 0:{String(wait).padStart(2, '0')}</>
          ) : (
            <button type="button" onClick={resend} disabled={resending} className="auth-card__link">
              Send a new code
            </button>
          )}
        </p>
        <p className="auth-card__alt">
          <Link href={changeEmail as Route} className="auth-card__link">Wrong email? Change it</Link>
        </p>
        <p className="auth-card__alt">The link in the email works too.</p>
      </div>
    </AuthStage>
  )
}

// useSearchParams() needs a Suspense boundary for `next build` to prerender.
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  )
}
