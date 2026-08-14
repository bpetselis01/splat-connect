import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildCustomizationForm } from '@/components/child-customization-form'

describe('ChildCustomizationForm', () => {
  it('explains what this section is for', () => {
    render(<ChildCustomizationForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByText(/hand measurements and sensory preferences/i)).toBeInTheDocument()
  })

  it('pre-fills from an existing profile', () => {
    render(
      <ChildCustomizationForm
        profile={{ palm_width_mm: 40, needs_arm_attachment: true, sensory_preferences: ['Soft'] } as never}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Palm width (mm)')).toHaveValue(40)
    expect(screen.getByLabelText('Needs an arm attachment')).toBeChecked()
    expect(screen.getByLabelText('Soft')).toBeChecked()
  })

  it('starts blank when there is no profile yet', () => {
    render(<ChildCustomizationForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Palm width (mm)')).toHaveValue(null)
  })

  it('sends null for an untouched measurement rather than zero', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildCustomizationForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ palm_width_mm: null }))
  })

  it('hands the edited fields to onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildCustomizationForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Palm width (mm)'), { target: { value: '42' } })
    fireEvent.click(screen.getByLabelText('Needs an arm attachment'))
    fireEvent.click(screen.getByLabelText('Soft'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ palm_width_mm: 42, needs_arm_attachment: true, sensory_preferences: ['Soft'] })
    )
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildCustomizationForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
