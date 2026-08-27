import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/get-involved/design-challenges',
}))
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

/**
 * The save island.
 *
 * Default-off is the assertion that matters: this card also renders on
 * /dashboard/challenges, which is your own submitted ideas, where a save button
 * reads as a bug. Keeping that correct by DOING NOTHING beats keeping it
 * correct by remembering to switch something off there.
 */
describe('the save island', () => {
  const idea = { id: 'idea-1', title: 'Switch mount', summary: 'A summary', status: 'challenge' } as const

  it('renders no control and no wrapper when save is omitted', () => {
    const { container } = render(<ChallengeCard idea={idea} />)
    expect(container.querySelector('.save-host')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-testid', 'challenge-card')
  })

  it('renders the control as a sibling of the card link when save is given', () => {
    const { container } = render(
      <ChallengeCard
        idea={idea}
        save={{ slug: 'challenges', id: idea.id, saved: false, signedIn: true }}
      />
    )
    const host = container.querySelector('.save-host')
    expect(host).not.toBeNull()

    // A <button> inside an <a> is invalid HTML with an ambiguous click target.
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.closest('a')).toBeNull()
    expect(host!.querySelector('a')).not.toBeNull()
  })
})
