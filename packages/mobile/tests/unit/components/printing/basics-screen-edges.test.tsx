import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintingBasicsScreen } from '../../../../components/printing/basics-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))

beforeEach(() => mockPush.mockReset())

it('teaches all four ideas under their own headings', () => {
  render(<PrintingBasicsScreen />)
  for (const heading of [
    'What you are actually asking for',
    'PETG, PLA and why it matters',
    'Layer height and infill',
    'Bed size',
  ]) {
    expect(screen.getByRole('header', { name: heading })).toBeTruthy()
  }
})

it('says the printer checks the bed, and does not promise the list hides machines that are too small', () => {
  render(<PrintingBasicsScreen />)
  expect(screen.queryByText(/only shows printers whose bed fits/i)).toBeNull()
  expect(screen.getByText(/the printer checks the parts fit before they accept/)).toBeTruthy()
})

it('sends the reader on to Find a printer', () => {
  render(<PrintingBasicsScreen />)
  fireEvent.press(screen.getByRole('button', { name: 'Find a printer' }))
  expect(mockPush).toHaveBeenCalledWith('/printing')
})

it('names PETG as the answer for anything a child pulls on', () => {
  render(<PrintingBasicsScreen />)
  expect(screen.getByText(/asking for PLA because it is cheaper/)).toBeTruthy()
})
