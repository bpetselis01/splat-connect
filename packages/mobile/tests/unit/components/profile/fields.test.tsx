import { render, screen, fireEvent } from '@testing-library/react-native'
import { CHILD_MEASURES } from '@splat-connect/types'
import { MeasureField } from '../../../../components/profile/fields'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const hand = CHILD_MEASURES[0]

describe('MeasureField', () => {
  it('follows a stored value that changes while it is not being edited', () => {
    const { rerender } = render(<MeasureField measure={hand} value={null} onChange={() => {}} />)
    expect(screen.getByPlaceholderText('e.g. 62').props.value).toBe('')
    rerender(<MeasureField measure={hand} value={62} onChange={() => {}} />)
    expect(screen.getByPlaceholderText('e.g. 62').props.value).toBe('62')
  })

  it('keeps what the parent is typing while focused', () => {
    const { rerender } = render(<MeasureField measure={hand} value={62} onChange={() => {}} />)
    const input = screen.getByPlaceholderText('e.g. 62')
    fireEvent(input, 'focus')
    fireEvent.changeText(input, '400')
    // The wizard turns an out-of-range answer into null; the text must stay.
    rerender(<MeasureField measure={hand} value={null} onChange={() => {}} />)
    expect(screen.getByPlaceholderText('e.g. 62').props.value).toBe('400')
    expect(screen.getByText('Between 20 and 250.')).toBeTruthy()
  })
})
