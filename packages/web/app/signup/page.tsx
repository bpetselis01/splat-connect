'use client'
import {
  EnvelopeOpen,
  Eye,
  EyeSlash,
  CheckCircle,
  House,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'
import { AuthSplit, AuthStage, AuthTabs } from '@/components/auth-shell'
import { AGREEMENT_VERSIONS, type SignupIntent } from '@splat-connect/types'

/** The board's "I'm mostly here to…" tiles. Where each one lands is the login
 *  page's business — see INTENT_LANDING there. */
const INTENTS: { value: SignupIntent; label: string; Icon: typeof House }[] = [
  { value: 'family', label: 'Find toys for my child', Icon: House },
  { value: 'maker', label: 'Make and share guides', Icon: Wrench },
]

/** Supabase's own floor (supabase/config.toml). */
const MIN_PASSWORD = 6

function SignupForm() {
  const supabase = createClient()
  const params = useSearchParams()
  // Where the visitor was, and why they were sent here. SaveButton sets both.
  const next = params.get('next')
  const reason = params.get('reason')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  // Optional, and unpicked by default: a guess would send a maker to a child
  // profile they do not have.
  const [intent, setIntent] = useState<SignupIntent | null>(null)
  const [termsDialogOpen, setTermsDialogOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords don't match.")
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
        data: {
          name,
          contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms,
          // Read by the first sign-in to choose a landing (pendingIntent).
          ...(intent ? { intent } : {}),
        },
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
      <AuthStage>
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="auth-sent__badge">
            <EnvelopeOpen weight="fill" />
          </span>
          <h1 className="auth-sent__title">Check your email</h1>
          <p className="auth-sent__body">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm your email,
            then sign in.
          </p>
          <Link href="/login" className="auth-submit auth-submit--inline">
            Back to sign in
          </Link>
        </div>
      </AuthStage>
    )
  }

  const longEnough = password.length >= MIN_PASSWORD

  return (
    <AuthSplit>
      <form onSubmit={handleSubmit} className="signup__form">
        <AuthTabs current="signup" search={params.toString()} />

        {reason === 'save' && (
          <p className="alert bg-brand-tint text-ink">
            You need an account to save things. Create one and we&apos;ll take you back.
          </p>
        )}
        {reason === 'thanks' && (
          <p className="alert bg-brand-tint text-ink">
            You need an account to say thanks. Create one and we&apos;ll take you back.
          </p>
        )}
        {reason === 'child' && (
          <p className="alert bg-brand-tint text-ink">
            A free account keeps your child&apos;s profile. Create one and we&apos;ll take you
            straight to the questions.
          </p>
        )}
        {reason === 'download' && (
          <p className="alert bg-brand-tint text-ink">
            You need an account to download tutorial files. Create one and we&apos;ll take you back.
          </p>
        )}

        <fieldset className="auth-field">
          <legend className="auth-label">I&apos;m mostly here to…</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {INTENTS.map(({ value, label, Icon }) => {
              const on = intent === value
              return (
                <label
                  key={value}
                  className="flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 text-sm font-extrabold text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--focus)]"
                  style={{
                    borderColor: on ? 'var(--b600)' : 'var(--line)',
                    background: on ? 'var(--b50)' : 'var(--surface)',
                  }}
                >
                  <input
                    type="radio"
                    name="intent"
                    value={value}
                    checked={on}
                    onChange={() => setIntent(value)}
                    className="accent-[var(--b600)]"
                  />
                  <Icon weight="duotone" aria-hidden="true" className="shrink-0 text-xl text-[var(--b600)]" />
                  {label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="auth-field">
          <label htmlFor="name" className="auth-label auth-label--lg">Your name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            placeholder="How should we greet you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input auth-input--lg"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="email" className="auth-label auth-label--lg">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input auth-input--lg"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="password" className="auth-label auth-label--lg">Password</label>
          <div className="auth-password">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input auth-input--lg"
              aria-describedby="password-hint"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          {/* "Long enough", not the board's "Strong enough": the only rule is
              length, and calling six characters strong would be a promise the
              check does not make. */}
          <p id="password-hint" className={`auth-hint${longEnough ? ' auth-hint--ok' : ''}`}>
            {longEnough && <CheckCircle weight="fill" aria-hidden="true" />}
            {longEnough ? 'Long enough' : `At least ${MIN_PASSWORD} characters`}
          </p>
        </div>
        <div className="auth-field">
          <label htmlFor="confirm-password" className="auth-label auth-label--lg">Confirm password</label>
          {/* Follows the show toggle above, so both fields reveal together. */}
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="auth-input auth-input--lg"
          />
        </div>

        {/* A button, not a bare checkbox: the terms have to be READ before they
            are accepted, and acceptance is recorded at signup — so the row
            opens the dialog, and only the dialog's "I accept" ticks it. */}
        <button
          type="button"
          onClick={() => setTermsDialogOpen(true)}
          className="signup__terms"
          aria-pressed={acceptedTerms}
        >
          {/* The board's native checkbox, drawn but inert: the button around
              it is the control, so this is hidden from assistive tech and
              takes no pointer or focus of its own. */}
          <input
            type="checkbox"
            checked={acceptedTerms}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="signup__tick"
          />
          <span>
            I agree to the <span className="auth-card__link">contributor terms</span> and understand
            SPLAT Connect is not a medical device.
          </span>
        </button>

        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading || !acceptedTerms} className="auth-submit auth-submit--lg">
          {loading ? 'Creating…' : 'Create my account'}
        </button>
      </form>

      <ContributorTermsDialog
        open={termsDialogOpen}
        onClose={() => setTermsDialogOpen(false)}
        onAccepted={() => {
          setAcceptedTerms(true)
          setTermsDialogOpen(false)
        }}
      />
    </AuthSplit>
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
