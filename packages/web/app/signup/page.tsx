'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'
import { Check } from '@/components/icons'
import { AuthShell, AuthCard } from '@/components/auth-shell'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

function SignupForm() {
  const supabase = createClient()
  const params = useSearchParams()
  // Where the visitor was, and why they were sent here. SaveButton sets both.
  const next = params.get('next')
  const reason = params.get('reason')
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

    // enable_confirmations = true (supabase/config.toml:232), so signUp() leaves
    // no session — there is no bearer token yet to POST /api/agreements with.
    // The accepted version rides in user_metadata instead: handle_new_user()
    // (supabase/migrations/010_signup_terms_acceptance.sql) reads it in the same
    // security-definer trigger that already creates the profile, so the
    // acceptance is recorded before the user ever reaches the onboarding gate.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        // Carry the destination through the email round trip. Without it the
        // chain ends at /login with no idea where the visitor started, which
        // for someone who clicked save on one of twelve results means coming
        // back with no memory of which.
        emailRedirectTo: `${window.location.origin}/auth/confirmed${
          next ? `?next=${encodeURIComponent(next)}` : ''
        }`,
      },
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
      <AuthShell current="signup">
        <AuthCard>
          <div className="flex flex-col items-center text-center">
            <span aria-hidden="true" className="empty-badge">
              ✅
            </span>
            <h1 className="mt-4 text-[22px] font-black text-ink">Check your email</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm
              your email, then sign in.
            </p>
            <Link href="/login" className="btn btn-accent mt-6">
              Back to sign in
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell current="signup">
      <AuthCard>
        {reason === 'save' && (
          <p className="alert mb-4 bg-brand-tint text-ink">
            You need an account to save things. Create one and we&apos;ll take you back.
          </p>
        )}
        <h1 className="text-[22px] font-black text-ink">Create your account</h1>
        <p className="mb-[18px] mt-1.5 text-[13px] leading-relaxed text-muted">
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
              className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-pixel-xs border-2 border-ink ${
                acceptedTerms ? 'bg-ink text-white' : 'text-transparent'
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
        <p className="mt-4 text-center text-[13px] text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-brand-deep hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCard>
      <ContributorTermsDialog
        open={termsDialogOpen}
        onClose={() => setTermsDialogOpen(false)}
        onAccepted={() => {
          setAcceptedTerms(true)
          setTermsDialogOpen(false)
        }}
      />
    </AuthShell>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page — same reasoning as app/login/page.tsx.
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
