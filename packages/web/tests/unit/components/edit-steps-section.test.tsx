import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditStepsSection } from '@/components/edit-steps-section'
import { ToastProvider } from '@/components/toast'
import type { TutorialStep } from '@splat-connect/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))

const step: TutorialStep = { id: 's1', tutorial_id: 't', position: 1, title: null, body: 'Do it', photo_url: null }

describe('EditStepsSection', () => {
  it('saves each step with its tip and minutes, blank becoming null', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditStepsSection tutorialId="t" steps={[step, { ...step, id: 's2', position: 2 }]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Step 1 tip'), { target: { value: ' Mind the edge ' } })
    fireEvent.change(screen.getByLabelText('Step 1 minutes'), { target: { value: '10' } })
    fireEvent.click(screen.getByText('Save steps'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        expect.objectContaining({ tip: 'Mind the edge', minutes: 10 }),
        expect.objectContaining({ tip: null, minutes: null }),
      ])
    )
  })
})
