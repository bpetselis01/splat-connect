import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveStatusLine } from '@/components/save-status-line'

describe('SaveStatusLine', () => {
  it('renders nothing when there is no save yet', () => {
    const { container } = render(<SaveStatusLine savedAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Last saved just now" right after a save', () => {
    render(<SaveStatusLine savedAt={new Date().toISOString()} />)
    expect(screen.getByText('Last saved just now')).toBeInTheDocument()
  })
})
