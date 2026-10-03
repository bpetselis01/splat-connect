import { render, screen } from '@testing-library/react-native'
import { PrintingBasicsScreen } from '../../../../components/printing/basics-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))

describe('PrintingBasicsScreen', () => {
  it('holds the hero picture slot as To be completed', () => {
    render(<PrintingBasicsScreen />)
    expect(screen.getByText('To be completed')).toBeTruthy()
    expect(screen.getByText('Printing basics')).toBeTruthy()
  })
})
