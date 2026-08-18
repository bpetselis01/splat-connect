import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorialImage } from '@/components/editorial-image'

describe('EditorialImage', () => {
  it('falls back to the illustration when there is no photo', () => {
    const { container } = render(<EditorialImage illustration="switch" ratio="3/2" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('/illustrations/switch.svg')
  })

  it('prefers a real photo when one exists', () => {
    const { container } = render(
      <EditorialImage src="/photos/workshop.jpg" illustration="switch" ratio="3/2" />
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('workshop.jpg')
  })

  // Decorative in both states: every slot has a heading beside it, so naming the
  // subject here would be a duplicate announcement. Same rule as CardPhoto.
  it('keeps alt empty whether it renders a photo or an illustration', () => {
    const { container: a } = render(<EditorialImage illustration="printer" ratio="2/1" />)
    expect(a.querySelector('img')).toHaveAttribute('alt', '')
    const { container: b } = render(
      <EditorialImage src="/photos/p.jpg" illustration="printer" ratio="2/1" />
    )
    expect(b.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('credits a real photo when a caption is given', () => {
    render(
      <EditorialImage src="/photos/p.jpg" illustration="family" ratio="3/2" caption="Photo: SPLAT workshop" />
    )
    expect(screen.getByText('Photo: SPLAT workshop')).toBeInTheDocument()
  })

  it('never credits an illustration, even if a caption is passed', () => {
    render(<EditorialImage illustration="family" ratio="3/2" caption="Photo: SPLAT workshop" />)
    expect(screen.queryByText('Photo: SPLAT workshop')).toBeNull()
  })

  it('applies the fixed ratio so a later photo cannot reflow the page', () => {
    const { container } = render(<EditorialImage illustration="maker" ratio="1/1" />)
    expect(container.querySelector('[data-ratio="1/1"]')).not.toBeNull()
  })
})
