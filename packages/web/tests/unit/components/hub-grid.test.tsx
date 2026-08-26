import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubGrid } from '@/components/hub-grid'
import type { NavItem } from '@/lib/public-nav'

const items: NavItem[] = [
  { href: '/learn/switch-types', label: 'Switch types', state: 'live', blurb: 'Which switch suits which child.' },
  { href: '/learn/ask-an-expert', label: 'Ask an expert', state: 'soon', featureKey: 'ask-an-expert', blurb: 'Put a question to an OT.' },
]

describe('HubGrid', () => {
  it('links each item and shows its blurb', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /switch types/i })).toHaveAttribute(
      'href',
      '/learn/switch-types'
    )
    expect(screen.getByText('Which switch suits which child.')).toBeInTheDocument()
  })

  it('marks a not-yet-built item', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /ask an expert/i })).toHaveTextContent(/soon/i)
  })

  it('does not mark a live item', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /switch types/i })).not.toHaveTextContent(/soon/i)
  })

  it('renders nothing for an empty list rather than an empty grid', () => {
    const { container } = render(<HubGrid items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders every card upright — no tilt class on any grid item', () => {
    const { container } = render(
      <HubGrid items={[
        { href: '/a', label: 'A', blurb: 'a', state: 'live' },
        { href: '/b', label: 'B', blurb: 'b', state: 'live' },
      ]} />
    )
    const cards = container.querySelectorAll('a.card-pixel')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.parentElement?.className).not.toMatch(/tilt-\d/)
    }
  })
})
