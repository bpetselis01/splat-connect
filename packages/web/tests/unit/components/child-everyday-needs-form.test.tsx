import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildEverydayNeedsForm } from '@/components/child-everyday-needs-form'

describe('ChildEverydayNeedsForm', () => {
  it('explains what this section is for', () => {
    render(<ChildEverydayNeedsForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByText(/what's tricky day-to-day/i)).toBeInTheDocument()
  })

  it('pre-fills from an existing profile', () => {
    render(
      <ChildEverydayNeedsForm
        profile={{ challenges: ['Grasping'], grip_type: 'Pincer' } as never}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Grasping')).toBeChecked()
    expect(screen.getByLabelText('Grip type')).toHaveValue('Pincer')
  })

  it('starts blank when there is no profile yet', () => {
    render(<ChildEverydayNeedsForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Grasping')).not.toBeChecked()
  })

  it('hands the edited fields to onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildEverydayNeedsForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByLabelText('Grasping'))
    fireEvent.change(screen.getByLabelText('Grip type'), { target: { value: 'Pincer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ challenges: ['Grasping'], grip_type: 'Pincer' })
    )
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildEverydayNeedsForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
