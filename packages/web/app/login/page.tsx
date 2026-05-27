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
 * 4. Checks user profile (role, approved status)
 * 5. Redirects based on account status:
 *    - If approved: → /dashboard (contributor hub)
 *    - If not approved: → /pending ("awaiting approval")
 * 6. If error: Shows error message
 * 
 * Related flows:
 * - Sign up: /signup (creates new account)
 * - After approval: Admin approves account → user redirected to /dashboard
 * - Sign out: Nav component handles logout
 * 
 * Related files:
 * - app/signup: Create new account
 * - app/pending: "Awaiting approval" page
 * - app/dashboard: Contributor hub (after approved)
 * - lib/supabase/client.ts: Supabase auth client
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
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
        .select('role, approved')
        .eq('id', user!.id)
        .single()

      router.refresh()
      if (profile?.role === 'contributor') {
        router.push(profile.approved ? '/dashboard' : '/pending')
      } else if (profile?.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Sign in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1e3a5f] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#16304f] disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        Want to contribute?{' '}
        <Link href="/signup" className="text-blue-600 hover:underline">
          Request access
        </Link>
      </p>
    </div>
  )
}
