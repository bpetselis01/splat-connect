import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildAbilityForm } from '@/components/child-ability-form'

describe('ChildAbilityForm', () => {
  it('explains what this section is for', () => {
    render(<ChildAbilityForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByText(/basic info about your child/i)).toBeInTheDocument()
  })

  it('pre-fills from an existing profile', () => {
    render(
      <ChildAbilityForm
        profile={{ name: 'Emma', age: 7, macs_level: 'II' } as never}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Emma')
    expect(screen.getByLabelText('Age')).toHaveValue(7)
    expect(screen.getByLabelText('MACS level')).toHaveValue('II')
  })

  it('starts blank when there is no profile yet', () => {
    render(<ChildAbilityForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('')
  })

  it('hands the edited fields to onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildAbilityForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Emma' } })
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Emma', age: 7 }))
  })

  it('marks a manually chosen MACS level as manual, overriding any prior estimate', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildAbilityForm profile={{ macs_level: 'I', macs_source: 'estimated' } as never} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('MACS level'), { target: { value: 'III' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ macs_level: 'III', macs_source: 'manual' }))
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildAbilityForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
