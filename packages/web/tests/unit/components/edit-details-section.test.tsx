import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditDetailsSection } from '@/components/edit-details-section'
import { ToastProvider } from '@/components/toast'
import type { Tutorial } from '@splat-connect/types'

// The component calls router.refresh() after a successful write, because
// revalidatePath alone does not re-render a client component that invoked a
// server action.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const tutorial: Tutorial = {
  id: 't1',
  title: 'Spoon Holder',
  description: null,
  difficulty: 'easy',
  status: 'draft',
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  updated_at: '2026-08-01T00:00:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('EditDetailsSection', () => {
  it('submits the loaded updated_at alongside the edited fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Title', updated_at: '2026-08-01T00:00:00.000Z' })
      )
    )
  })

  it('shows the conflict message when onSave signals a conflict', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
  })

  it('shows a "Last saved" line after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    expect(screen.queryByText(/last saved/i)).toBeNull()
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Details saved" after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details saved'))
  })

  it('does not show a toast or save-status line when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/last saved/i)).not.toBeInTheDocument()
  })
})
