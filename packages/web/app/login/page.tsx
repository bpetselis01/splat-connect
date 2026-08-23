'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sanitiseNextPath } from '@/lib/safe-next-path'

function LoginForm() {
  const supabase = createClient()
  const next = useSearchParams().get('next')
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
      // `next` is only honoured once sanitiseNextPath has confirmed it is a
      // same-origin path — see lib/safe-next-path.ts for why that check
      // exists. Absent or rejected, it falls back to the role-based default.
      const fallback = profile?.role === 'admin' ? '/admin' : '/dashboard'
      window.location.href = sanitiseNextPath(next) ?? fallback
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
