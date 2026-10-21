import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { StlFile } from '@splat-connect/types'
import { StlSettingsForm } from '@/components/stl-settings-form'
import { ToastProvider } from '@/components/toast'

const file: StlFile = {
  id: 'f1', tutorial_id: 't1', filename: 'mount.stl', file_url: 't1/mount.stl',
  print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 40, size_y_mm: 30, size_z_mm: 20,
}

describe('StlSettingsForm', () => {
  it('WT28 saves the sizes with the settings, so neither erases the other', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <StlSettingsForm files={[file]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Width (mm)'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save print settings' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('f1', {
        print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 45, size_y_mm: 30, size_z_mm: 20,
      })
    )
  })
})
