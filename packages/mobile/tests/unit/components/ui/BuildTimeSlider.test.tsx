// journeys: T13
import { render, screen, fireEvent } from '@testing-library/react-native'
import { BUILD_TIME_OPTIONS } from '@splat-connect/types'
import { indexForMinutes, minutesForIndex, BuildTimeSlider } from '../../../../components/ui/BuildTimeSlider'

it('maps minutes to the nearest stop and back', () => {
  expect(indexForMinutes(60)).toBe(BUILD_TIME_OPTIONS.indexOf(60))
  expect(minutesForIndex(0)).toBe(10)
  expect(minutesForIndex(BUILD_TIME_OPTIONS.length - 1)).toBe(240)
})
it('has no index for an unset value', () => {
  expect(indexForMinutes(null)).toBeNull()
})
it('snaps an off-list stored value (e.g. 100) to the nearest stop', () => {
  expect(minutesForIndex(indexForMinutes(100)!)).toBe(90)
})
it('shows Not set until a value exists and saves only on release', () => {
  const onCommit = jest.fn()
  render(<BuildTimeSlider value={null} onCommit={onCommit} />)
  expect(screen.getByText('Not set')).toBeTruthy()
  const slider = screen.getByLabelText('Build time')
  fireEvent(slider, 'valueChange', 5)
  expect(onCommit).not.toHaveBeenCalled()
  fireEvent(slider, 'slidingComplete', 5)
  expect(onCommit).toHaveBeenCalledWith(BUILD_TIME_OPTIONS[5])
})
it('labels the top stop "4 h or more"', () => {
  render(<BuildTimeSlider value={240} onCommit={() => {}} />)
  expect(screen.getAllByText('4 h or more').length).toBeGreaterThan(0)
})
it('does not save on mount', () => {
  const onCommit = jest.fn()
  render(<BuildTimeSlider value={100} onCommit={onCommit} />)
  expect(onCommit).not.toHaveBeenCalled()
})
