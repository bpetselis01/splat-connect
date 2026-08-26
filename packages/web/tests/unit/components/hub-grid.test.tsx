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

  /*
   * The board tints every child card, not just the first. HubGrid used to tint
   * only a "lead" card and leave its siblings white, on the reasoning that a
   * six-card hub all in one hue reads as "a wall of one hue". That was sound
   * about a flat six-card grid and does not apply here: every hub page already
   * splits its children into labelled groups, so no grid on the site renders
   * more than four cards. See the spec, "Grouped hub children — already done".
   */
  it('tints every card, not just the first', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    const cards = container.querySelectorAll('a.card-pixel')
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.className).toContain('bg-honey-soft')
    }
  })

  it('gives every card a tone-coloured art slot', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    const slots = container.querySelectorAll('[aria-hidden="true"].border-dashed')
    expect(slots).toHaveLength(2)
    for (const slot of slots) {
      expect(slot.className).toContain('text-honey-deep')
    }
  })

  /* The board draws no arrow on a hub child card, and no card is wider than
     any other — both were this component's own inventions. */
  it('draws no arrow and no wide lead card', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    expect(container.textContent).not.toContain('→')
    for (const cell of container.querySelectorAll('a.card-pixel')) {
      expect(cell.className).not.toContain('col-span-2')
      expect(cell.parentElement?.className).not.toContain('col-span-2')
    }
  })

  /* Two column counts, because the board draws two — 3-up for the primary
     groups, 4-up for the "more in this section" tails. */
  it('lays out four columns when asked', () => {
    const { container } = render(<HubGrid items={items} tone="honey" columns={4} />)
    expect(container.firstElementChild!.className).toContain('lg:grid-cols-4')
  })

  it('lays out three columns by default', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    expect(container.firstElementChild!.className).toContain('lg:grid-cols-3')
  })
})
