import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Route } from 'next'
import { DeleteEntityButton } from '@/components/delete-entity-button'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

// The dialog element stays in the DOM when closed, so "is it open" is read off
// the `open` attribute rather than off query failures — jsdom applies no UA
// stylesheet, so a closed dialog's contents are still queryable.
function openDialog(
  label = 'Child 1',
  endpoint = '/api/child-profiles/c1',
  redirectTo = '/dashboard/profile'
) {
  render(<DeleteEntityButton endpoint={endpoint} redirectTo={redirectTo as Route<string>} label={label} />)
  fireEvent.click(screen.getByRole('button', { name: `Delete ${label}` }))
  return screen.getByRole('dialog')
}

describe('DeleteEntityButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the dialog without deleting', () => {
    const dialog = openDialog()
    expect(dialog).toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('keeps Delete disabled until the exact phrase is typed', () => {
    openDialog()
    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_child_1' } })
    expect(confirm).toBeDisabled() // case-sensitive

    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    expect(confirm).toBeEnabled()
  })

  it('builds the phrase from a name with spaces', () => {
    openDialog('Mary Jane')
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Mary_Jane' } })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('deletes and returns to the redirect target once confirmed', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/child-profiles/c1'))
    expect(push).toHaveBeenCalledWith('/dashboard/profile')
    expect(refresh).toHaveBeenCalled()
  })

  it('Cancel closes without deleting and clears the typed phrase', () => {
    const dialog = openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Child 1' }))
    expect(screen.getByLabelText(/to confirm/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('Escape closes without deleting', () => {
    const dialog = openDialog()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('a backdrop click closes without deleting', () => {
    const dialog = openDialog()
    fireEvent.click(dialog)
    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('a click inside the dialog body does not close it', () => {
    const dialog = openDialog()
    fireEvent.click(screen.getByLabelText(/to confirm/i))
    expect(dialog).toHaveAttribute('open')
  })

  it('reports a failed delete, stays open, and does not navigate', async () => {
    vi.mocked(browserApiClient.delete).mockRejectedValue(new Error('network'))
    const dialog = openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete')
    expect(push).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByLabelText(/to confirm/i)).toHaveValue('confirm_delete_Child_1')
  })

  it('deletes a toy via its own endpoint and label', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    openDialog('toy', '/api/toys/t1', '/dashboard/toys')
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_toy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/toys/t1'))
    expect(push).toHaveBeenCalledWith('/dashboard/toys')
    expect(screen.getByText('Delete toy?')).toBeInTheDocument()
    expect(screen.getByText(/permanently deletes this toy/)).toBeInTheDocument()
  })
})
