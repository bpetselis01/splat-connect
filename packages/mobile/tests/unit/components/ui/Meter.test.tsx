// packages/mobile/tests/unit/components/ui/Meter.test.tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Meter } from '../../../../components/ui/Meter'

function fillWidth() {
  return StyleSheet.flatten(screen.getByTestId('meter-fill').props.style).width
}

describe('Meter', () => {
  it('labels the value out of max for screen readers', () => {
    render(<Meter value={7} />)
    expect(screen.getByLabelText('7 of 10')).toBeTruthy()
  })

  it('respects a custom max in the label', () => {
    render(<Meter value={3} max={4} />)
    expect(screen.getByLabelText('3 of 4')).toBeTruthy()
  })

  it('fills the bar proportional to value/max', () => {
    render(<Meter value={5} max={10} />)
    expect(fillWidth()).toBe('50%')
  })

  it('recomputes the fill against a custom max', () => {
    render(<Meter value={3} max={4} />)
    expect(fillWidth()).toBe('75%')
  })

  it('applies the requested track width', () => {
    render(<Meter value={2} width={80} />)
    const track = StyleSheet.flatten(screen.getByLabelText('2 of 10').props.style)
    expect(track.width).toBe(80)
  })
})
