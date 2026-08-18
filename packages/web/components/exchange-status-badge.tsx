/**
 * Where a donation or exchange sits in its lifecycle.
 *
 * Third sibling of status-badge.tsx and toy-status-badge.tsx, for the same
 * reason those two are separate: a transaction is never draft or published, and
 * a union over all three lifecycles would give every caller cases it cannot hit.
 *
 * Colours are borrowed on meaning, not on spelling. `accepted` takes the brand
 * tint rather than mint because the handoff is arranged but not done — mint is
 * the palette's "this is finished" signal and belongs to `completed`.
 */
import type { ToyTransaction } from '@splat-connect/types'

const styles: Record<ToyTransaction['status'], string> = {
  requested: 'bg-honey-soft text-honey-deep',
  accepted: 'bg-brand-tint text-brand-deep',
  completed: 'bg-mint-soft text-mint-deep',
  rejected: 'bg-apricot-soft text-apricot-deep',
  withdrawn: 'bg-sunken text-brand-deep',
}

export function ExchangeStatusBadge({ status }: { status: ToyTransaction['status'] }) {
  return <span className={`badge ${styles[status]}`}>{status.toUpperCase()}</span>
}
