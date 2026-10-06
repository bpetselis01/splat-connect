// A label must break between words or not at all: at the largest text size
// "Exchanges" used to wrap to "Exchan/ges" in the Inbox pills.
import { render, screen } from '@testing-library/react-native'
import { Segmented } from '../../../../components/ui/Segmented'

const options = [
  { value: 'a', label: 'Exchanges' },
  { value: 'b', label: 'Notifications' },
]

describe('Segmented', () => {
  it.each(['pills', 'tint'] as const)('keeps %s labels on one line, shrunk to fit and capped', (variant) => {
    render(<Segmented label="Inbox" variant={variant} value="a" onChange={() => {}} options={options} />)
    const text = screen.getByText('Exchanges')
    expect(text.props.numberOfLines).toBe(1)
    expect(text.props.adjustsFontSizeToFit).toBe(true)
    expect(text.props.maxFontSizeMultiplier).toBe(1.3)
  })

  it('caps track labels too, and keeps the a11y label on each tab', () => {
    render(<Segmented label="Inbox" value="a" onChange={() => {}} options={options} />)
    expect(screen.getByText('Exchanges').props.maxFontSizeMultiplier).toBe(1.3)
    expect(screen.getByRole('tab', { name: 'Exchanges' })).toBeTruthy()
  })

  it('draws a count badge after the label and folds it into the a11y name', () => {
    render(<Segmented label="Guide sections" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Overview' }, { value: 'b', label: 'Feedback', badge: 3 }]} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Feedback (3)' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy()
  })

  it('draws no badge at zero', () => {
    render(<Segmented label="Guide sections" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Feedback', badge: 0 }]} />)
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeTruthy()
  })
})
