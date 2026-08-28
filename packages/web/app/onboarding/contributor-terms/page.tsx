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
import { FileText } from '@/components/icons'

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
      <div className="mt-6 w-full text-left">
        <TermsGate
          type="contributor_terms"
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
      </div>
      <button type="button" onClick={signOut} className="mt-4 text-sm text-muted underline">
        Sign out
      </button>
    </>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page (it can't statically render something that reads the
// query string). The icon, heading and lead paragraph stay outside the
// boundary so they render immediately rather than waiting on it.
export default function ContributorTermsOnboarding() {
  return (
    <div className="mx-auto mt-8 max-w-lg sm:mt-16">
      <div className="card flex flex-col items-center p-6 text-center sm:p-8">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <FileText className="h-8 w-8" />
        </span>
        <h1 className="mt-4 title-article">One thing before you continue</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Please review and accept the contributor terms to carry on.
        </p>
        <Suspense>
          <ContributorTermsForm />
        </Suspense>
      </div>
    </div>
  )
}
