import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingButton } from '@/components/pending-button'

describe('PendingButton', () => {
  it('links to the item’s Not built yet page', () => {
    render(<PendingButton pending="makers-ask-first" label="Ask first" />)
    expect(screen.getByRole('link', { name: 'Ask first' }).getAttribute('href')).toBe('/not-built/makers-ask-first')
  })
})
