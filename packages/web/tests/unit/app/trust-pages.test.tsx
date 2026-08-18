import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import SafetyPage from '@/app/safety/page'
import CodeOfConductPage from '@/app/code-of-conduct/page'

describe('trust pages', () => {
  it('gives the privacy policy a heading and a last-updated date', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByText(/last updated/i)).toBeInTheDocument()
  })

  // The three things this platform holds that a generic policy would miss.
  // Each phrase legitimately recurs across several sections of the policy, so
  // getAllByText (rather than getByText) is used to avoid a false "multiple
  // elements" failure on text that is correctly repeated.
  it('names the sensitive data the platform actually holds', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/child profile/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pickup address/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/email address/i).length).toBeGreaterThan(0)
  })

  it('tells people how to get their data deleted', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })

  it('renders the terms of use', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument()
  })

  it('warns about the specific hazards of adapting toys', () => {
    render(<SafetyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /safety/i })).toBeInTheDocument()
    expect(screen.getByText(/small parts/i)).toBeInTheDocument()
    // "button cell" is mentioned twice (the battery warning, then the AA/AAA
    // fallback list), so getAllByText avoids a false "multiple elements" failure.
    expect(screen.getAllByText(/button cell|coin cell/i).length).toBeGreaterThan(0)
  })

  it('renders the code of conduct with a reporting route', () => {
    render(<CodeOfConductPage />)
    expect(screen.getByRole('heading', { level: 1, name: /code of conduct/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })
})
