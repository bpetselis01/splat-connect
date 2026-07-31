import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContributorTermsContent } from '@/components/contributor-terms-content'

describe('ContributorTermsContent', () => {
  it('states the terms are not yet binding', () => {
    render(<ContributorTermsContent />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })
})
