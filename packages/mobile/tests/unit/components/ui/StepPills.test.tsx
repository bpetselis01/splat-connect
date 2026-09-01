// packages/mobile/tests/unit/components/ui/StepPills.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { StepPills } from '../../../../components/ui/StepPills'

const steps = [
  { id: 'details', label: 'Details', status: 'done' as const },
  { id: 'files', label: 'Files', status: 'attention' as const },
  { id: 'review', label: 'Review', status: 'neutral' as const },
]

describe('StepPills', () => {
  it('marks only the active pill selected, and fires onSelect on a tap', () => {
    const onSelect = jest.fn()
    render(<StepPills steps={steps} active="details" onSelect={onSelect} />)

    expect(screen.getByRole('tab', { name: 'Details' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByRole('tab', { name: 'Files' }).props.accessibilityState.selected).toBe(false)
    expect(screen.getByRole('tab', { name: 'Review' }).props.accessibilityState.selected).toBe(false)

    fireEvent.press(screen.getByRole('tab', { name: 'Files' }))
    expect(onSelect).toHaveBeenCalledWith('files')
  })

  it('prefixes a done pill with a mint check, an attention pill with a dot, and leaves neutral bare', () => {
    render(<StepPills steps={steps} active="details" onSelect={jest.fn()} />)

    expect(
      screen.getByTestId('step-pill-check-details', { includeHiddenElements: true })
    ).toBeTruthy()
    expect(
      screen.getByTestId('step-pill-dot-files', { includeHiddenElements: true })
    ).toBeTruthy()
    expect(screen.queryByTestId('step-pill-check-review', { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByTestId('step-pill-dot-review', { includeHiddenElements: true })).toBeNull()
  })
})
