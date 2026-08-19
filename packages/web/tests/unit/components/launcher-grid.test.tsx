import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'

const tiles: LauncherTile[] = [
  { href: '/library' as LauncherTile['href'], label: 'Guides', blurb: 'Adaptation tutorials', count: 42 },
  { href: '/about' as LauncherTile['href'], label: 'About', blurb: 'Who we are' },
]

describe('LauncherGrid', () => {
  it('links every tile', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about')
  })

  it('shows a count where there is one', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders a tile without a count rather than showing a zero', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByRole('link', { name: /about/i })).not.toHaveTextContent('0')
  })

  // An API failure degrades the whole page to zeros; the launcher must still be
  // navigable, since it is the fastest route out of a broken homepage.
  it('still links everything when every count is zero', () => {
    render(<LauncherGrid tiles={tiles.map((t) => ({ ...t, count: 0 }))} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
