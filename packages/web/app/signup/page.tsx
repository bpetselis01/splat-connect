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
          <h1 className="mt-4 text-2xl font-bold text-ink">Request received</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your account has been created. You can log in and start uploading tutorials
            right away.
          </p>
          <Link href="/login" className="btn btn-soft mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Request contributor access</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          Create your contributor account to start uploading tutorials.
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
            {loading ? 'Submitting…' : 'Request access'}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Already have access?{' '}
        <Link href="/login" className="font-semibold text-brand-dark hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
