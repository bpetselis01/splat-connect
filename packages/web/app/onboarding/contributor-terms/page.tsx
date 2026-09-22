'use client'
/**
 * The catch-up gate for any account without a recorded contributor_terms
 * acceptance — accounts that predate the terms, or were created without
 * going through app/signup/page.tsx (e.g. admin-created). A normal signup
 * carries the accepted version through signUp()'s user_metadata, recorded by
 * handle_new_user() before any session exists, so this gate has nothing left
 * to ask that account for. Reached only by redirect from middleware.ts, which
 * passes the path the user was blocked from as ?next=.
 *
 * Related files:
 * - middleware.ts: decides who lands here
 * - components/terms-gate.tsx: the acceptance control itself
 * - components/contributor-terms-content.tsx: the terms text shown inline
 * - app/legal/contributor-terms: the same text, as a standalone page
 * - supabase/migrations/010_signup_terms_acceptance.sql: where signup records it
 */
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Route } from 'next'
import { TermsGate } from '@/components/terms-gate'
import { ContributorTermsContent } from '@/components/contributor-terms-content'
import { createClient } from '@/lib/supabase/client'
import { AuthStage } from '@/components/auth-shell'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

/**
 * `next` arrives from the query string, so it is attacker-controllable. Only a
 * same-origin path is honoured: it must start with exactly one '/', which rules
 * out both absolute URLs and protocol-relative '//host' redirects.
 *
 * Backslashes are normalized to forward slashes before the check: browsers treat
 * /\ as an authority separator in special URL schemes, turning /\evil.example
 * into a cross-origin redirect. Normalizing collapses all backslash variants
 * into cases the protocol-relative check already rejects.
 */
function safeNext(raw: string | null): Route<string> {
  if (!raw) return '/dashboard' as Route<string>
  const normalized = raw.replace(/\\/g, '/')
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return '/dashboard' as Route<string>
  return normalized as Route<string>
}

function ContributorTermsForm() {
  const supabase = createClient()
  const next = safeNext(useSearchParams().get('next'))

  async function signOut() {
    await supabase.auth.signOut()
    // Hard reload, not router.push: a client navigation can leave the server
    // layout still rendering the signed-in shell until a full refresh — same
    // reasoning as the rail's own sign-out (components/rail.tsx).
    window.location.href = '/'
  }

  return (
    <>
      <TermsGate
        type="contributor_terms"
        variant="stage"
        requireCheckbox
        content={<ContributorTermsContent />}
        // Hard reload, not router.replace: the bare gate's Nav prefetches
        // /dashboard as soon as it's in viewport, well before terms are
        // accepted. That prefetch resolves as the middleware's redirect
        // back to this gate, and Next's client Router Cache serves that
        // stale redirect straight back on replace(next) — a soft nav never
        // reaches the server to see the acceptance that was just recorded.
        // Same reasoning as signOut() above.
        onAccepted={() => {
          window.location.href = next
        }}
      />
      {/* Not on the board, which has no way out of this gate; kept, because
          an account that will not accept has nowhere else to sign out. */}
      <p className="auth-card__alt">
        <button type="button" onClick={signOut} className="text-muted underline">
          Sign out
        </button>
      </p>
    </>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page (it can't statically render something that reads the
// query string). The eyebrow, heading and version line stay outside the
// boundary so they render immediately rather than waiting on it.
export default function ContributorTermsOnboarding() {
  return (
    <AuthStage>
      <span className="eyebrow text-muted">One step before you start</span>
      <h1 className="auth-sent__title mt-2">Contributor terms</h1>
      {/* The version is the recorded one; the board's "you keep the copyright"
          is a claim about terms that are not written yet, so it is not here. */}
      <p className="mb-[18px] mt-2 text-sm text-muted">
        Version {AGREEMENT_VERSIONS.contributor_terms}.
      </p>
      <Suspense>
        <ContributorTermsForm />
      </Suspense>
    </AuthStage>
  )
}
