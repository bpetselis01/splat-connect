import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChoiceChips, NeedsChips } from '../../../../components/profile/fields'
import { WORKING_HAND } from '@splat-connect/types'

describe('ChoiceChips', () => {
  it('marks the chosen option selected and the rest not', () => {
    render(<ChoiceChips label="Which hand?" options={WORKING_HAND} value="right" onChange={jest.fn()} />)
    expect(screen.getByText('Which hand?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Right', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Left', selected: false })).toBeTruthy()
  })

  it('emits a new choice, and null when the chosen one is pressed again', () => {
    const onChange = jest.fn()
    render(<ChoiceChips options={WORKING_HAND} value="right" onChange={onChange} />)
    fireEvent.press(screen.getByRole('button', { name: 'Left' }))
    expect(onChange).toHaveBeenLastCalledWith('left')
    fireEvent.press(screen.getByRole('button', { name: 'Right' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('NeedsChips', () => {
  it('adds and removes a need', () => {
    const onChange = jest.fn()
    render(<NeedsChips value={['quiet']} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Quiet toys only', selected: true })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Wipeable' }))
    expect(onChange).toHaveBeenLastCalledWith(['quiet', 'wipeable'])
    fireEvent.press(screen.getByRole('button', { name: 'Quiet toys only' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})
