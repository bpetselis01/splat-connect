import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComingSoon } from '@/components/coming-soon'

describe('ComingSoon', () => {
  it('names the feature and lists how it will work', () => {
    render(
      <ComingSoon
        label="Toy Library"
        description="Associations near you with adapted and accessible toys."
        steps={['Find associations near you', 'Browse the adapted toys they hold']}
      />
    )
    expect(screen.getByRole('heading', { name: 'Toy Library' })).toBeInTheDocument()
    expect(screen.getByText('Toy Library is coming soon.')).toBeInTheDocument()
    expect(screen.getByText('Find associations near you')).toBeInTheDocument()
    expect(screen.getByText('Browse the adapted toys they hold')).toBeInTheDocument()
  })

  // Chain: a placeholder that dead-ends is most of what a new parent sees. It
  //        must route to the part of the app that already works.
  it('offers a way onward', () => {
    render(<ComingSoon label="3D Printing" description="Request a printed part." steps={[]} />)
    expect(screen.getByRole('link', { name: 'Browse tutorials' })).toHaveAttribute(
      'href',
      '/library'
    )
  })
})
