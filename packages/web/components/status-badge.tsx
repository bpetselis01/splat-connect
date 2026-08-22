/**
 * Tutorial Status Badge
 *
 * Shows where a tutorial sits in the review lifecycle.
 *
 * Prop:
 * - status: 'draft' | 'pending' | 'approved' | 'rejected'
 *
 * The dashboard and My Tutorials pages each carried their own copy of this
 * status→colour map, which is how they drifted apart. Colours come from the
 * shared palette (see app/globals.css), so pending reads as the same honey as a
 * medium-difficulty badge rather than as Tailwind yellow.
 *
 * Used in:
 * - app/dashboard/tutorials/page.tsx (via components/dashboard-tutorial-card.tsx)
 */
import type { TutorialStatus } from '@splat-connect/types'

const styles: Record<TutorialStatus, string> = {
  draft: 'bg-sunken text-brand-deep',
  pending: 'bg-honey-soft text-honey-deep',
  approved: 'bg-mint-soft text-mint-deep',
  rejected: 'bg-apricot-soft text-apricot-deep',
}

export function StatusBadge({ status }: { status: TutorialStatus }) {
  return <span className={`badge ${styles[status]}`}>{status.toUpperCase()}</span>
}
