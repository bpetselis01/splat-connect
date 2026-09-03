import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditDetailsSection } from '@/components/edit-details-section'
import { ToastProvider } from '@/components/toast'
import { renderLeavable } from '@/tests/unit/leaving'
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
  kind: 'toy_adaptation',
  status: 'draft',
  maturity: 'complete',
  safety_declared_at: '2026-08-01T00:00:00Z',
  tutorial_pdf_url: null,
  photo_urls: [],
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  updated_at: '2026-08-01T00:00:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('EditDetailsSection', () => {
  // Kind is a select like difficulty, so a wrong card on /upload is one save
  // to fix rather than a new tutorial.
  it('submits the chosen kind', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ToastProvider><EditDetailsSection tutorial={tutorial} onSave={onSave} /></ToastProvider>)
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'assistive_tech' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'assistive_tech' }))
    )
  })

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
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
  })

  it('fires the shared toast with "Details saved" after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details saved'))
  })

  it('does not show a toast when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('Save button starts disabled', () => {
    render(<EditDetailsSection tutorial={tutorial} onSave={vi.fn()} />)
    expect(screen.getByText('Save details')).toBeDisabled()
  })

  it('Save button becomes enabled after a field change', () => {
    render(<EditDetailsSection tutorial={tutorial} onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    expect(screen.getByText('Save details')).not.toBeDisabled()
  })

  it('Save button becomes disabled again after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByText('Save details')).toBeDisabled())
  })
})

describe('EditDetailsSection on leaving the step', () => {
  function setup(onSave: ReturnType<typeof vi.fn>) {
    return renderLeavable(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
  }

  // Tests: an edited but unsaved form is written on the way out
  // Chain: the form is uncontrolled and the panel unmounts on a step change, so
  //        the edit lived only in the DOM that was about to be torn down
  it('saves an edited form', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { leave } = setup(onSave)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Renamed' } })

    expect(await leave()).toBe(true)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Renamed' }))
  })

  // Tests: an untouched form is left alone
  // Chain: every write here carries the updated_at loaded at render, and a write
  //        nobody asked for is the one most likely to lose a conflict to a real one
  it('writes nothing when the form was never touched', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { leave, holding } = setup(onSave)
    expect(holding()).toBe(false)
    expect(await leave()).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })

  // Tests: a conflicting write keeps the contributor on the step
  // Chain: this panel's whole reason for being a client component is showing the
  //        conflict rather than crashing to an error boundary; navigating away
  //        from it would be the same loss by another route
  it('reports a rejected save so the step holds', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    const { leave } = setup(onSave)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Renamed' } })
    expect(await leave()).toBe(false)
  })
})
