'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="mx-auto mt-8 max-w-sm sm:mt-16">
        <div className="card flex flex-col items-center p-6 text-center sm:p-8">
          <span aria-hidden="true" className="empty-badge">
            ✅
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">You&apos;re all set</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your account is ready to go.
          </p>
          {/* WHY: supabase/config.toml sets enable_confirmations = false, so
              signUp() above already returned a live session — the user is
              signed in the moment this screen renders, not merely registered.
              HOW: link straight to the dashboard instead of /login. If
              confirmations are ever enabled (packages/mobile/lib/auth-context.tsx
              already sets an emailRedirectTo, so some environment may expect
              this), this screen needs to go back to telling the user to check
              their email and sign in. */}
          <Link href="/dashboard" className="btn btn-soft mt-6">
            Go to your dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          One account for everything — browse, contribute, and manage your child&apos;s profile.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="field-label">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="mt-1.5 text-xs text-muted">
              At least 6 characters.
            </p>
          </div>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-accent btn-block mt-2">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-dark hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
