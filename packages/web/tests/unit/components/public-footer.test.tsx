import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicFooter } from '@/components/public-footer'
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'

describe('PublicFooter', () => {
  it('gives every section a column heading', () => {
    render(<PublicFooter />)
    for (const section of PUBLIC_NAV) {
      expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
        'href',
        section.href
      )
    }
  })

  // The whole reason the footer exists: one click to anywhere, from anywhere.
  it('links every child of every section exactly once with correct href', () => {
    render(<PublicFooter />)
    for (const child of PUBLIC_NAV.flatMap((s) => s.children)) {
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const links = screen.getAllByRole('link', {
        name: new RegExp(`^${escapeRegex(child.label)}( SOON)?$`),
      })
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', child.href)
    }
  })

  it('links every legal page', () => {
    render(<PublicFooter />)
    for (const legal of FOOTER_LEGAL) {
      expect(screen.getByRole('link', { name: legal.label })).toHaveAttribute('href', legal.href)
    }
  })

  it('marks not-yet-built destinations so the footer is not a set of traps', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: /design challenges/i })).toHaveTextContent(/soon/i)
  })

  it('contains no button or expandable control — it is plain links only', () => {
    render(<PublicFooter />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })
})
