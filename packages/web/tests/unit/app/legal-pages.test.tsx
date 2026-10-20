import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContributorTermsPage from '@/app/legal/contributor-terms/page'
import IntendedPurposePage from '@/app/legal/intended-purpose/page'
import OrgLeaderTermsPage from '@/app/legal/org-leader-terms/page'

describe('legal pages', () => {
  it('WL05 shows the contributor terms stub that the signup dialog and the gate show', () => {
    render(<ContributorTermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Contributor terms' })).toBeInTheDocument()
    expect(screen.getByText(/these terms have not been written yet/i)).toBeInTheDocument()
  })

  it('WL06 states it is not a medical device and links to contact', () => {
    render(<IntendedPurposePage />)
    expect(screen.getByRole('heading', { level: 1, name: /what splat connect is/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'It is not a medical device' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'contact us' })).toHaveAttribute('href', '/contact')
  })

  it('WL07 is the not-written-yet stub', () => {
    render(<OrgLeaderTermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Organisation leader terms' })).toBeInTheDocument()
    expect(screen.getByText(/these terms have not been written yet/i)).toBeInTheDocument()
  })
})
