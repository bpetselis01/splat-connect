'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { browserApiClient } from '@/lib/browser-api-client'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'
import { Check } from '@/components/icons'

export default function SignupPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [termsDialogOpen, setTermsDialogOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

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

    // enable_confirmations = true (supabase/config.toml:232), so signUp() left
    // no session — this call only records anything if that ever changes for
    // some environment. Deliberately non-fatal either way: the account exists
    // regardless of what happens here, and /onboarding/contributor-terms
    // catches an unrecorded acceptance at first sign-in.
    try {
      await browserApiClient.post('/api/agreements', {
        agreement_type: 'contributor_terms',
      })
    } catch {
      // See comment above — expected to fail every time under this config.
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
          <h1 className="mt-4 text-2xl font-bold text-ink">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm
            your email, then sign in.
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
          <div>
            <label htmlFor="confirm-password" className="field-label">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field"
            />
          </div>
          <button
            type="button"
            onClick={() => setTermsDialogOpen(true)}
            className="flex items-start gap-2 text-left text-sm"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                acceptedTerms
                  ? 'bg-brand-dark text-white'
                  : 'border border-brand-soft text-transparent'
              }`}
            >
              <Check className="h-3 w-3" />
            </span>
            <span>
              {acceptedTerms ? (
                'Contributor terms accepted'
              ) : (
                <>
                  Read and accept the{' '}
                  <span className="font-semibold text-brand-dark">contributor terms</span>
                </>
              )}
            </span>
          </button>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="btn btn-accent btn-block mt-2"
          >
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
      <ContributorTermsDialog
        open={termsDialogOpen}
        onClose={() => setTermsDialogOpen(false)}
        onAccepted={() => {
          setAcceptedTerms(true)
          setTermsDialogOpen(false)
        }}
      />
    </div>
  )
}
