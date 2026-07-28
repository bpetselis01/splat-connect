'use client'
/**
 * A leader is appointed by the admin rather than opting in, so the first time they
 * arrive at their org dashboard they may not have accepted org_leader_terms. The
 * review grant in 007 requires it, and the check sits in the policy's USING clause
 * — meaning an approve from an unaccepted leader matches zero rows and the API
 * returns 403. Without this banner the buttons look live and fail for no visible
 * reason.
 *
 * This mirrors the grant. It does not enforce it: the database refuses the write
 * whether or not this renders.
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: the review policy's has_accepted conjunct
 * - components/terms-gate.tsx: the acceptance control itself
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TermsGate } from '@/components/terms-gate'

export function OrgReviewBanner() {
  const [accepted, setAccepted] = useState(false)
  const router = useRouter()
  if (accepted) return null

  return (
    <div className="alert alert-warning">
      <h2>Accept the leader terms to review</h2>
      <p>
        You can see everything offered to your organisation, but you cannot approve
        or reject anything until you accept the leader terms. They cover publishing
        on the platform&apos;s behalf, and the fact that you can read
        members&apos; unpublished drafts.
      </p>
      <TermsGate
        type="org_leader_terms"
        onAccepted={() => {
          setAccepted(true)
          router.refresh()
        }}
      />
    </div>
  )
}
