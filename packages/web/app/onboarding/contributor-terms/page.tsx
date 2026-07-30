'use client'
/**
 * The catch-up gate for accounts created before contributor terms were part of
 * signup. Reached only by redirect from middleware.ts, which passes the path the
 * user was blocked from as ?next=.
 *
 * Related files:
 * - middleware.ts: decides who lands here
 * - components/terms-gate.tsx: the acceptance control itself
 * - app/legal/contributor-terms: the (unwritten) terms this links to
 */
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Route } from 'next'
import { TermsGate } from '@/components/terms-gate'

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
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))

  return (
    <TermsGate
      type="contributor_terms"
      requireCheckbox
      onAccepted={() => router.replace(next)}
    />
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page (it can't statically render something that reads the
// query string).
export default function ContributorTermsOnboarding() {
  return (
    <div className="mx-auto mt-8 max-w-lg sm:mt-16">
      <h1 className="text-2xl font-bold text-ink">One thing before you continue</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
        Your account was created before we asked contributors to accept terms.
        Please review and accept them to carry on.
      </p>
      <Suspense>
        <ContributorTermsForm />
      </Suspense>
    </div>
  )
}
