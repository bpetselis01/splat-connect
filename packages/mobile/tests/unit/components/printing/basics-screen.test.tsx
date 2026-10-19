import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintingBasicsScreen } from '../../../../components/printing/basics-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))

describe('PrintingBasicsScreen', () => {
  it('holds the hero picture slot as To be completed', () => {
    render(<PrintingBasicsScreen />)
    expect(screen.getByText('To be completed')).toBeTruthy()
    expect(screen.getByText('Printing basics')).toBeTruthy()
  })
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends its scroll one gutter above the home indicator, under Find a printer', () => {
  render(<PrintingBasicsScreen />)
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})

it('R19 sends "Find a printer" to the printer finder', () => {
  render(<PrintingBasicsScreen />)
  fireEvent.press(screen.getByText('Find a printer'))
  expect(mockPush).toHaveBeenCalledWith('/printing')
})
