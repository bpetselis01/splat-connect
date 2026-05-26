import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BuyLinksInput } from '@/components/buy-links-input'

describe('BuyLinksInput', () => {
  it('renders add button', () => {
    render(<BuyLinksInput />)
    expect(screen.getByRole('button', { name: /add buy link/i })).toBeInTheDocument()
  })

  it('calls onChange when a buy link is added', () => {
    const handleChange = vi.fn()
    render(<BuyLinksInput onChange={handleChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add buy link/i }))
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: '', url: '' })])
    )
  })

  it('renders existing buy links from initialLinks', () => {
    render(
      <BuyLinksInput
        initialLinks={[{ label: 'Amazon', url: 'https://amazon.com/product' }]}
        onChange={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Amazon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://amazon.com/product')).toBeInTheDocument()
  })
})
