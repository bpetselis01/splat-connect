import { render, screen, fireEvent } from '@testing-library/react-native'
import { Dropdown, ChipGroup, NumberField } from '../../../../components/profile/fields'

const OPTS = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
  { label: 'C', value: 'c' },
]

describe('Dropdown', () => {
  it('renders the label and emits the chosen value', () => {
    const onChange = jest.fn()
    render(<Dropdown label="Pick one" value={null} options={OPTS} onChange={onChange} />)
    expect(screen.getByText('Pick one')).toBeTruthy()
    fireEvent.press(screen.getByText('B'))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('ChipGroup', () => {
  it('adds a value on tap', () => {
    const onChange = jest.fn()
    render(<ChipGroup label="Tags" values={[]} options={OPTS} onChange={onChange} />)
    fireEvent.press(screen.getByText('A'))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('removes an already-selected value', () => {
    const onChange = jest.fn()
    render(<ChipGroup label="Tags" values={['a']} options={OPTS} onChange={onChange} />)
    fireEvent.press(screen.getByText('A'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('blocks selecting beyond max', () => {
    const onChange = jest.fn()
    render(<ChipGroup label="Tags" values={['a', 'b']} options={OPTS} max={2} onChange={onChange} />)
    fireEvent.press(screen.getByText('C'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('NumberField', () => {
  it('emits a number for numeric input', () => {
    const onChange = jest.fn()
    render(<NumberField label="Palm width" value={null} unit="mm" onChange={onChange} />)
    fireEvent.changeText(screen.getByPlaceholderText('Palm width'), '62')
    expect(onChange).toHaveBeenCalledWith(62)
  })

  it('emits null when cleared', () => {
    const onChange = jest.fn()
    render(<NumberField label="Palm width" value={62} unit="mm" onChange={onChange} />)
    fireEvent.changeText(screen.getByPlaceholderText('Palm width'), '')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('ignores non-numeric input', () => {
    const onChange = jest.fn()
    render(<NumberField label="Palm width" value={null} onChange={onChange} />)
    fireEvent.changeText(screen.getByPlaceholderText('Palm width'), 'abc')
    expect(onChange).not.toHaveBeenCalled()
  })
})
