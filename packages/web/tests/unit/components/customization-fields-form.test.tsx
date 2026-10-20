import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CustomizationFieldsForm } from '@/components/customization-fields-form'
import { ToastProvider } from '@/components/toast'

const mount = (initial = [] as Parameters<typeof CustomizationFieldsForm>[0]['initial'], onSave = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <ToastProvider>
      <CustomizationFieldsForm initial={initial} onSave={onSave} />
    </ToastProvider>
  )
  return onSave
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save customization fields' }))

describe('CustomizationFieldsForm', () => {
  it('WT28 saves a choice question with trimmed options', async () => {
    const onSave = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Tray thickness' } })
    fireEvent.change(screen.getByLabelText('Options, one per line'), { target: { value: '10 mm\n 15 mm \n\n' } })
    save()
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ key: 'tray_thickness', label: 'Tray thickness', kind: 'choice', options: ['10 mm', '15 mm'] }])
    )
  })

  it('saves a number question with its unit and range', async () => {
    const onSave = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Reach' } })
    fireEvent.click(screen.getByRole('button', { name: 'A number' }))
    fireEvent.change(screen.getByLabelText('Smallest'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Largest'), { target: { value: '600' } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ key: 'reach', label: 'Reach', kind: 'number', unit: 'mm', min: 100, max: 600 }]))
  })

  it('explains an unfinished question and saves nothing', () => {
    const onSave = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Tray thickness' } })
    save()
    expect(screen.getByRole('alert').textContent).toBe('“Tray thickness” needs 2 to 8 options.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('removes a question and saves the empty list; shows a save failure', async () => {
    const onSave = mount([{ key: 'reach', label: 'Reach', kind: 'number', unit: 'mm', min: 100, max: 600 }], vi.fn().mockRejectedValue(new Error('Nope')))
    fireEvent.click(screen.getByRole('button', { name: 'Remove this question' }))
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]))
    expect((await screen.findByRole('alert')).textContent).toBe('Nope')
  })
})
