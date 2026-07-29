/**
 * Login Page
 * 
 * Allows existing users to log in with email/password.
 * Authentication is handled by Supabase.
 * 
 * Process:
 * 1. User enters email and password
 * 2. Supabase verifies credentials
 * 3. If valid: Sets session JWT in secure cookie
 * 4. Checks user profile role
 * 5. Redirects based on role: admin → /admin, everyone else → /dashboard
 * 6. If error: Shows error message
 *
 * Related flows:
 * - Sign up: /signup (creates new account)
 * - Sign out: Nav component handles logout
 * 
 * Related files:
 * - app/signup: Create new account
 * - app/dashboard: hub for any signed-in account
 * - lib/supabase/client.ts: Supabase auth client
 */
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      window.location.href = profile?.role === 'admin' ? '/admin' : '/dashboard'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-ink">Sign in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary btn-block mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-brand-dark hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
