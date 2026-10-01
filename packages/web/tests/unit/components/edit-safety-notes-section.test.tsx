import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditSafetyNotesSection } from '@/components/edit-safety-notes-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('EditSafetyNotesSection', () => {
  it('adds a note and saves the list', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditSafetyNotesSection notes={[]} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a safety note' }))
    fireEvent.change(screen.getByLabelText('Safety note 1 title'), { target: { value: 'Battery door must be screwed shut' } })
    fireEvent.change(screen.getByLabelText('Safety note 1 detail'), { target: { value: 'The base clips by default. Add the screw.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save safety notes' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ title: 'Battery door must be screwed shut', detail: 'The base clips by default. Add the screw.' }])
    )
  })
})
