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
  // Exact counts, not just >0: this copy is fixed content pending legal
  // review, so a test that fires when someone edits it is doing its job —
  // it forces the change to be a conscious one, not a silent one.
  it('names the sensitive data the platform actually holds', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/child profile/i)).toHaveLength(6)
    expect(screen.getAllByText(/pickup address/i)).toHaveLength(3)
    expect(screen.getAllByText(/email address/i)).toHaveLength(2)
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
    // Exact count, not just >0: this copy is fixed content pending legal
    // review, so a test that fires when someone edits it is doing its job —
    // it forces the change to be a conscious one, not a silent one.
    expect(screen.getAllByText(/button cell|coin cell/i)).toHaveLength(2)
  })

  it('renders the code of conduct with a reporting route', () => {
    render(<CodeOfConductPage />)
    expect(screen.getByRole('heading', { level: 1, name: /code of conduct/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })
})
