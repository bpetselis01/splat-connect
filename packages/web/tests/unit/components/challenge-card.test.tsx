import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChallengeCard } from '@/components/challenge-card'

describe('ChallengeCard', () => {
  // Tests: the card links to its own detail route
  // How:   renders and checks the anchor's href
  // Chain: this card is the only way into the [id] page from the listing —
  //        without this link the detail route Task 14 built is unreachable
  it('links to the challenge detail page', () => {
    render(
      <ChallengeCard idea={{ id: 'idea-1', title: 'Switch mount', summary: 'A summary', status: 'challenge' }} />
    )

    expect(screen.getByTestId('challenge-card')).toHaveAttribute(
      'href',
      '/get-involved/design-challenges/idea-1'
    )
  })

  it('shows the "Being written up" badge for a graduated challenge', () => {
    render(
      <ChallengeCard idea={{ id: 'idea-2', title: 'Adapted switch', summary: 'A summary', status: 'graduated' }} />
    )

    expect(screen.getByText('Being written up')).toBeInTheDocument()
  })
})
