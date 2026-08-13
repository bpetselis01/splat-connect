import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyDetailsForm } from '@/components/toy-details-form'

describe('ToyDetailsForm', () => {
  it('hands the edited fields to onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ToyDetailsForm toy={{ name: 'Fire truck', description: null, condition: 8 }} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fire truck 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith({ name: 'Fire truck 2', description: null, condition: 8 })
  })

  it('pre-fills an existing toy', () => {
    render(
      <ToyDetailsForm
        toy={{ name: 'Robot', description: 'A friendly robot', condition: 6 }}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Robot')
    expect(screen.getByLabelText('Description')).toHaveValue('A friendly robot')
    expect(screen.getByLabelText('Condition (1–10)')).toHaveValue(6)
  })

  it('edits condition and description together', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ToyDetailsForm toy={{ name: 'Puzzle', description: null, condition: 5 }} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Condition (1–10)'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Missing a few pieces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith({ name: 'Puzzle', condition: 9, description: 'Missing a few pieces' })
  })

  it('says which end of the condition scale is which', () => {
    render(<ToyDetailsForm toy={{ name: 'Robot', description: null, condition: 6 }} onSave={vi.fn()} />)
    expect(screen.getByText(/10 means brand new, 1 means heavily worn/i)).toBeInTheDocument()
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ToyDetailsForm toy={{ name: 'Kazoo', description: null, condition: 3 }} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
