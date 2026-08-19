import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'

const tiles: LauncherTile[] = [
  { href: '/library', label: 'Guides', blurb: 'Adaptation tutorials', tone: 'brand', rank: 'pillar', count: 42 },
  { href: '/about', label: 'About', blurb: 'Who we are', tone: 'plain', rank: 'supporting' },
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

  // The size difference is the message: a stranger should be able to tell what
  // SPLAT provides from what SPLAT merely explains, without reading a word.
  it('gives pillars more of the grid than supporting sections', () => {
    const { container } = render(<LauncherGrid tiles={tiles} />)
    const [pillar, supporting] = Array.from(container.firstElementChild!.children)
    expect(pillar.className).toContain('lg:col-span-4')
    expect(supporting.className).toContain('lg:col-span-3')
  })

  it('gives a pillar its section colour and leaves supporting tiles plain', () => {
    const { container } = render(<LauncherGrid tiles={tiles} />)
    const [pillar, supporting] = Array.from(container.firstElementChild!.children)
    expect(pillar.innerHTML).toContain('bg-brand-tint')
    expect(supporting.innerHTML).toContain('bg-surface')
  })
})
