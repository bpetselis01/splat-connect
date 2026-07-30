'use client'
/**
 * Renders an explicit acceptance control for one agreement type and calls
 * onAccepted once the acceptance is recorded. Shared by the submit flow
 * (contributor_terms) and the leader dashboard (org_leader_terms) so the two
 * cannot drift apart.
 *
 * The gate is a UX affordance only. The API refuses an ungated submission and the
 * database refuses an ungated review, whatever this component shows. It
 * deliberately does NOT call onAccepted when the request fails: telling the UI an
 * acceptance was recorded when the server never recorded one leaves the user
 * facing a 403 they cannot explain.
 *
 * Related files:
 * - packages/api/src/routes/agreements.ts: the endpoint, which picks the version
 * - app/legal: the documents this links to (empty, pending a lawyer)
 */
import { useState } from 'react'
import Link from 'next/link'
import { browserApiClient } from '@/lib/browser-api-client'
import type { AgreementType } from '@splat-connect/types'

// `as const` rather than a Record annotation: Next's typed routes need href to be
// a literal, and a Record<..., { href: string }> widens it away.
const LABELS = {
  contributor_terms: { title: 'contributor terms', href: '/legal/contributor-terms' },
  org_leader_terms: { title: 'organisation leader terms', href: '/legal/org-leader-terms' },
} as const satisfies Record<AgreementType, { title: string; href: string }>

export function TermsGate({
  type,
  onAccepted,
  requireCheckbox = false,
}: {
  type: AgreementType
  onAccepted: () => void
  requireCheckbox?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticked, setTicked] = useState(false)
  const { title, href } = LABELS[type]

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post('/api/agreements', { agreement_type: type })
      onAccepted()
    } catch {
      setError('Could not record your acceptance. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <p>
        Please read the <Link href={href}>{title}</Link> before continuing.
      </p>
      {error && <p role="alert" className="alert alert-danger mt-3">{error}</p>}
      {requireCheckbox && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ticked}
            onChange={(e) => setTicked(e.target.checked)}
          />
          I have read and accept the {title}
        </label>
      )}
      <button type="button" onClick={accept} disabled={busy || (requireCheckbox && !ticked)} className="btn btn-accent mt-3">
        {busy ? 'Recording…' : `I accept the ${title}`}
      </button>
    </div>
  )
}
