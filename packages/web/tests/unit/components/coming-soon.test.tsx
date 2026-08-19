import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComingSoon } from '@/components/coming-soon'

const props = {
  label: 'Toy Library',
  description: 'Associations near you with adapted and accessible toys.',
  steps: ['Find associations near you', 'Browse the adapted toys they hold'],
}

describe('ComingSoon', () => {
  it('leads with the feature name and says plainly that it is not built', () => {
    render(<ComingSoon {...props} />)
    expect(screen.getByRole('heading', { name: 'Toy Library' })).toBeInTheDocument()
    expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
  })

  it('explains how it will work', () => {
    render(<ComingSoon {...props} />)
    expect(screen.getByText('Find associations near you')).toBeInTheDocument()
    expect(screen.getByText('Browse the adapted toys they hold')).toBeInTheDocument()
  })

  // Chain: a placeholder that dead-ends is most of what a new parent sees. It
  //        must route to the part of the app that already works.
  it('always routes onward to something that works', () => {
    render(<ComingSoon label="3D Printing" description="Request a printed part." steps={[]} />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
  })

  it('offers the notify form when a feature key is given', () => {
    render(<ComingSoon {...props} featureKey="requests" />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('omits the notify form when no feature key is given', () => {
    render(<ComingSoon {...props} />)
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })
})
