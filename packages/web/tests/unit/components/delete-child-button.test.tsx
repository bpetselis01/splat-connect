import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeleteChildButton } from '@/components/delete-child-button'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

describe('DeleteChildButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  // Chain: a child profile is a page of hand-entered data with no undo, so one
  //        misclick must not destroy it.
  it('does not delete on the first click', () => {
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    expect(browserApiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
  })

  it('deletes and returns to the list on the second click', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/child-profiles/c1'))
    expect(push).toHaveBeenCalledWith('/dashboard/child')
  })

  // Chain: an armed button left armed is a trap for the next click on the page.
  it('disarms itself after 3 seconds', () => {
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('button', { name: 'Delete child profile' })).toBeInTheDocument()
  })

  it('reports a failed delete instead of pretending it worked', async () => {
    vi.mocked(browserApiClient.delete).mockRejectedValue(new Error('network'))
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete')
    expect(push).not.toHaveBeenCalled()
  })
})
