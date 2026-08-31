import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge, IDEA_LABEL, type BadgeStatus } from '@/components/badge'

/* Replaces difficulty-badge.test.tsx. Badge absorbed six components that each
   held their own copy of the same palette; the table below is the frozen record
   of what every one of them rendered, so a tidy-up of the map cannot quietly
   repaint a status. */
const EXPECTED: Array<[BadgeStatus, string, string]> = [
  // tutorial review — was StatusBadge
  ['draft', 'DRAFT', 'badge bg-sunken text-brand-deep'],
  ['pending', 'PENDING', 'badge bg-honey-soft text-honey-deep'],
  ['approved', 'APPROVED', 'badge bg-mint-soft text-mint-deep'],
  ['rejected', 'REJECTED', 'badge bg-apricot-soft text-apricot-deep'],
  // toy — was ToyStatusBadge
  ['published', 'PUBLISHED', 'badge bg-mint-soft text-mint-deep'],
  // exchange — was ExchangeStatusBadge
  ['requested', 'REQUESTED', 'badge bg-honey-soft text-honey-deep'],
  ['accepted', 'ACCEPTED', 'badge bg-brand-tint text-brand-deep'],
  ['completed', 'COMPLETED', 'badge bg-mint-soft text-mint-deep'],
  ['withdrawn', 'WITHDRAWN', 'badge bg-sunken text-brand-deep'],
  // difficulty — was DifficultyBadge
  ['easy', 'EASY', 'badge bg-mint-soft text-mint-deep'],
  ['medium', 'MEDIUM', 'badge bg-honey-soft text-honey-deep'],
  ['hard', 'HARD', 'badge bg-apricot-soft text-apricot-deep'],
  // kind — was KindBadge, always the neutral pair
  ['toy_adaptation', 'Toy adaptation', 'badge bg-sunken text-brand-deep'],
  ['assistive_tech', 'Assistive tech', 'badge bg-sunken text-brand-deep'],
  // idea → challenge — was IdeaStatusBadge, which carries its own copy
  ['challenge', 'Looking for makers', 'badge bg-brand-tint text-brand-deep'],
  ['graduated', 'Being written up', 'badge bg-mint-soft text-mint-deep'],
]

const LABELS: Partial<Record<BadgeStatus, string>> = {
  toy_adaptation: 'Toy adaptation',
  assistive_tech: 'Assistive tech',
  challenge: IDEA_LABEL.challenge,
  graduated: IDEA_LABEL.graduated,
}

describe('Badge', () => {
  // Tests: every status word renders the text and the class pair its old
  //        dedicated component rendered
  // How:   renders each row of the table above; checks textContent and className
  // Chain: these pills are how a maker reads a tutorial's review state, a
  //        donor reads an exchange's state and a browser reads difficulty — a
  //        repaint here is a silently wrong signal on every listing page
  it.each(EXPECTED)('renders %s', (status, text, className) => {
    const { container } = render(<Badge status={status} label={LABELS[status]} />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe(text)
    expect(span?.className).toBe(className)
  })

  // Tests: the idea lifecycle words that collide with other lifecycles keep the
  //        author-facing copy rather than the shouted status word
  // How:   renders pending and rejected with IDEA_LABEL
  // Chain: 'Pending review' and 'Not taken forward' match challenge-card.tsx —
  //        the author's view must never claim more than the public card does
  it('keeps the idea wording for words other lifecycles also use', () => {
    render(<Badge status="pending" label={IDEA_LABEL.pending} />)
    render(<Badge status="rejected" label={IDEA_LABEL.rejected} />)
    expect(screen.getByText('Pending review')).toBeInTheDocument()
    expect(screen.getByText('Not taken forward')).toBeInTheDocument()
  })
})
