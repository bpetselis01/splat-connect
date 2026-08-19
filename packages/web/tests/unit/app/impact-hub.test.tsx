import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubGrid } from '@/components/hub-grid'
import { PUBLIC_NAV } from '@/lib/public-nav'

/**
 * The page itself is an async server component that fetches, which jsdom cannot
 * render. The E2E spec in Task 20 covers the fetched content. What is verified
 * here is the piece this task adds: the section's children rendered as a grid.
 */
const impact = PUBLIC_NAV.find((s) => s.href === '/impact')!

describe('Impact hub grid', () => {
  it('surfaces every Impact child', () => {
    render(<HubGrid items={impact.children} />)
    for (const child of impact.children) {
      expect(screen.getByRole('link', { name: new RegExp(child.label, 'i') })).toBeInTheDocument()
    }
  })

  it('links the organisations directory, which used to be signed-in only', () => {
    render(<HubGrid items={impact.children} />)
    expect(screen.getByRole('link', { name: /organisations/i })).toHaveAttribute(
      'href',
      '/organizations'
    )
  })

  it('marks news, events and the map as not yet built', () => {
    render(<HubGrid items={impact.children} />)
    for (const label of [/news/i, /events/i, /map/i]) {
      expect(screen.getByRole('link', { name: label })).toHaveTextContent(/soon/i)
    }
  })
})
