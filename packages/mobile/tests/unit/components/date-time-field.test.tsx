import { Platform } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { DateTimeField, formatPicked, parsePicked } from '../../../components/ui/DateTimeField'

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}))

it('writes the picked moment as the strings the form validates, and reads them back', () => {
  const at = new Date(2026, 9, 8, 9, 5)
  expect(formatPicked(at, 'date')).toBe('2026-10-08')
  expect(formatPicked(at, 'time')).toBe('09:05')
  const back = parsePicked('2026-10-08', 'date', new Date(2020, 0, 1))
  expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 9, 8])
  expect(parsePicked('14:30', 'time', new Date(2020, 0, 1)).getHours()).toBe(14)
  // Garbage leaves the fallback alone rather than an Invalid Date.
  expect(parsePicked('soon', 'date', new Date(2020, 0, 1)).getFullYear()).toBe(2020)
})

it('on iOS, an empty field says so, and opening it takes the value the wheel shows', () => {
  const onChange = jest.fn()
  render(<DateTimeField label="Starts" mode="time" value="" onChange={onChange} placeholder="10:00" openOn={new Date(2026, 0, 1, 10, 0)} />)
  expect(screen.getByText('Choose a time')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Starts, not set'))
  expect(onChange).toHaveBeenCalledWith('10:00')
  expect(screen.getByText('Done')).toBeTruthy()
})

it('on Android, opens the system dialog instead of drawing one', () => {
  const { DateTimePickerAndroid } = jest.requireMock('@react-native-community/datetimepicker')
  const os = Platform.OS
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })
  try {
    render(<DateTimeField label="Date" mode="date" value="2026-10-18" onChange={jest.fn()} placeholder="2026-10-18" />)
    fireEvent.press(screen.getByLabelText(/^Date, /))
    expect(DateTimePickerAndroid.open).toHaveBeenCalledWith(expect.objectContaining({ mode: 'date' }))
    expect(screen.queryByText('Done')).toBeNull()
  } finally {
    Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true })
  }
})
