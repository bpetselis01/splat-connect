import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BuyLinksInput } from '@/components/buy-links-input'

describe('BuyLinksInput', () => {
  // Tests: the BuyLinksInput component renders an "Add buy link" button by default
  // How:   renders <BuyLinksInput /> with no props; checks the button is in the document
  // Chain: the button is the entry point for adding buy links to a part or tool → users can
  //        optionally add purchase links without the component requiring any initial data
  it('renders add button', () => {
    render(<BuyLinksInput />)
    expect(screen.getByRole('button', { name: /add buy link/i })).toBeInTheDocument()
  })

  // Tests: clicking "Add buy link" calls the onChange callback with a new empty link entry
  // How:   passes a vi.fn() as onChange; clicks the button; checks onChange was called with
  //        an array containing an object with empty label and url fields
  // Chain: the parent component (upload wizard or edit form) receives the updated links array →
  //        it saves the new entry to local state before the step's Next/Save action
  it('calls onChange when a buy link is added', () => {
    const handleChange = vi.fn()
    render(<BuyLinksInput onChange={handleChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add buy link/i }))
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: '', url: '' })])
    )
  })

  // Tests: buy links provided via initialLinks are rendered as pre-filled input fields
  // How:   passes initialLinks with one link {label: 'Amazon', url: '...'}; checks both values appear in inputs
  // Chain: the edit form pre-populates links from the saved tutorial record → contributors
  //        can update or remove existing links without having to re-enter them from scratch
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
