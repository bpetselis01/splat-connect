/**
 * A toy's status, in the same shape and palette tutorials use.
 *
 * Sibling of status-badge.tsx rather than an extension of it: the two describe
 * different lifecycles (a toy is never pending or rejected — nobody reviews
 * it), so one component over a union of both would carry four cases each caller
 * can never hit.
 *
 * The colours are borrowed deliberately. Draft reads identically on both pages
 * because it means the same thing, and published takes the mint that approved
 * uses, which is the palette's "this is live" signal.
 */
import type { Toy } from '@splat-connect/types'

const styles: Record<Toy['status'], string> = {
  draft: 'bg-sunken text-brand-deep',
  published: 'bg-mint-soft text-mint-deep',
}

export function ToyStatusBadge({ status }: { status: Toy['status'] }) {
  return <span className={`badge ${styles[status]}`}>{status.toUpperCase()}</span>
}
