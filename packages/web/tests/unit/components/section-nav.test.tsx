import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionNav } from '@/components/section-nav'

describe('SectionNav', () => {
  it('renders nothing for a flat catalogue', () => {
    const { container } = render(<SectionNav pathname="/library" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing outside the public tree', () => {
    const { container } = render(<SectionNav pathname="/dashboard" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens with an Overview link back to the section hub', () => {
    render(<SectionNav pathname="/learn/switch-types" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/learn')
  })

  it('lists every sibling in the section', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: /toy adaptation 101/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3d printing basics/i })).toBeInTheDocument()
  })

  it('marks the active child for assistive tech', () => {
    render(<SectionNav pathname="/learn/switch-types" />)
    expect(screen.getByRole('link', { name: /switch types/i })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks Overview active on the hub itself, not a child', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('flags a not-yet-built child so the expectation is set before the click', () => {
    render(<SectionNav pathname="/learn" />)
    const soon = screen.getByRole('link', { name: /ask an expert/i })
    expect(soon).toHaveTextContent(/soon/i)
  })

  it('does not flag a live child', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: /switch types/i })).not.toHaveTextContent(/soon/i)
  })
})
