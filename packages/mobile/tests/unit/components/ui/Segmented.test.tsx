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
})
