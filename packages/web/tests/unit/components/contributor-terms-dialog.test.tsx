import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'

describe('ContributorTermsDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepting ticks the box, clicks Accept, and calls onAccepted only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /^I accept/i }))

    expect(onAccepted).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clicking Reject calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('a click that lands on the dialog element itself (the backdrop) calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('a click inside the content does not call onClose', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('the native cancel event (Escape) calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('renders the shared terms content', () => {
    render(<ContributorTermsDialog open onClose={vi.fn()} onAccepted={vi.fn()} />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })
})
