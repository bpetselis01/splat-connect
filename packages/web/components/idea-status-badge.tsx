/**
 * Where a submitted idea sits in the review-to-challenge lifecycle, for the
 * author's own view (app/dashboard/challenges/page.tsx).
 *
 * Fourth sibling of status-badge.tsx, exchange-status-badge.tsx and
 * toy-status-badge.tsx, kept separate for the same reason those three are:
 * no lifecycle here shares a case with another's.
 *
 * Copy matches components/challenge-card.tsx's public wording exactly —
 * 'graduated' means a maker has taken the idea on and a draft guide is being
 * written, never that a guide is published, so this must never claim more
 * than the public card does.
 */
import type { ToyIdeaStatus } from '@splat-connect/types'

const COPY: Record<ToyIdeaStatus, string> = {
  pending: 'Pending review',
  challenge: 'Looking for makers',
  graduated: 'Being written up',
  rejected: 'Not taken forward',
}

const STYLES: Record<ToyIdeaStatus, string> = {
  pending: 'bg-honey-soft text-honey-deep',
  challenge: 'bg-brand-tint text-brand-deep',
  graduated: 'bg-mint-soft text-mint-deep',
  rejected: 'bg-apricot-soft text-apricot-deep',
}

export function IdeaStatusBadge({ status }: { status: ToyIdeaStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{COPY[status]}</span>
}
