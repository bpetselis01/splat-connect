import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import SafetyPage from '@/app/safety/page'
import CodeOfConductPage from '@/app/code-of-conduct/page'

// ProsePage ends on a nav of related pages; the prose's own links are the ones outside it.
const bodyLinks = (root: HTMLElement) =>
  [...root.querySelectorAll('a')].filter((a) => !a.closest('nav')).map((a) => a.getAttribute('href'))

describe('trust pages', () => {
  it('WL01 gives the privacy policy a heading and a last-updated date', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByText(/last updated/i)).toBeInTheDocument()
  })

  // The three things this platform holds that a generic policy would miss.
  // Exact counts, not just >0: this copy is fixed content pending legal
  // review, so a test that fires when someone edits it is doing its job —
  // it forces the change to be a conscious one, not a silent one.
  it('WL01 names the sensitive data the platform actually holds', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/child profile/i)).toHaveLength(6)
    expect(screen.getAllByText(/pickup address/i)).toHaveLength(3)
    expect(screen.getAllByText(/email address/i)).toHaveLength(2)
  })

  it('WL01 names the region where the data is hosted', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/hosted in Sydney, Australia/)).toBeInTheDocument()
  })

  it('WL01 links to the intended-purpose statement, the deletion page and contact', () => {
    const { container } = render(<PrivacyPage />)
    expect(bodyLinks(container)).toEqual(['/legal/intended-purpose', '/delete-account', '/contact'])
  })

  it('WL02 renders the terms of use and links to the pages it relies on', () => {
    const { container } = render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument()
    expect(bodyLinks(container)).toEqual([
      '/legal/intended-purpose',
      '/safety',
      '/code-of-conduct',
      '/legal/contributor-terms',
      '/contact',
    ])
  })

  it('WL03 warns about the specific hazards of adapting toys', () => {
    const { container } = render(<SafetyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /safety/i })).toBeInTheDocument()
    expect(screen.getAllByText(/small parts/i).length).toBeGreaterThan(0)
    // Exact count, not just >0: this copy is fixed content pending legal
    // review, so a test that fires when someone edits it is doing its job —
    // it forces the change to be a conscious one, not a silent one.
    expect(screen.getAllByText(/button cell|coin cell/i)).toHaveLength(2)
    expect(bodyLinks(container)).toEqual(['/contact'])
  })

  it('WL04 renders the code of conduct with a reporting route', () => {
    const { container } = render(<CodeOfConductPage />)
    expect(screen.getByRole('heading', { level: 1, name: /code of conduct/i })).toBeInTheDocument()
    expect(bodyLinks(container)).toEqual(['/contact'])
  })
})
