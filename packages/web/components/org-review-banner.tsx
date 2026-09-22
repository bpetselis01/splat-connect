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
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'
import { TermsGate } from '@/components/terms-gate'

/**
 * `strip` is the dashboard queue's one-line form from the board: the sentence
 * and a "Read and accept" button that opens the same TermsGate, so there is
 * still exactly one acceptance control.
 */
export function OrgReviewBanner({ variant = 'block' }: { variant?: 'block' | 'strip' }) {
  const [accepted, setAccepted] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  if (accepted) return null

  const gate = (
    <TermsGate
      type="org_leader_terms"
      onAccepted={() => {
        setAccepted(true)
        router.refresh()
      }}
    />
  )

  if (variant === 'strip') {
    return (
      <div className="mb-[18px] flex flex-wrap items-center gap-3.5 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--tamber)] px-5 py-[18px]">
        <WarningCircle weight="duotone" aria-hidden="true" className="shrink-0 text-[26px] text-[var(--tink)]" />
        <p className="min-w-60 flex-1 text-sm font-bold leading-normal text-[var(--tink)]">
          You have not accepted the leader terms. You can read the queue, but not approve anything.
        </p>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn min-h-11 shrink-0 bg-ink px-[18px] text-sm text-surface"
          >
            Read and accept
          </button>
        )}
        {open && <div className="basis-full">{gate}</div>}
      </div>
    )
  }

  return (
    <div className="alert alert-warning">
      <h2>Accept the leader terms to review</h2>
      <p>
        You can see everything offered to your organisation, but you cannot approve
        or reject anything until you accept the leader terms. They cover publishing
        on the platform&apos;s behalf, and the fact that you can read
        members&apos; unpublished drafts.
      </p>
      {gate}
    </div>
  )
}
