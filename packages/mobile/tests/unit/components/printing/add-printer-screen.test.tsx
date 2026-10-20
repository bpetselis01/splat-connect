import { CLEARANCE, paddingBottomOf } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AddPrinterScreen } from '../../../../components/printing/add-printer-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }, ledOrgs: [] } }),
}))

beforeEach(() => mockPost.mockReset())

it('R17 sends the standard rates with the printer', async () => {
  mockPost.mockResolvedValue({})
  render(<AddPrinterScreen />)
  expect(screen.getByText('Nothing listed — your card will say you cover everything yourself.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Bambu P1S')
  fireEvent.changeText(screen.getByLabelText('Dollars per gram'), '0.12')
  fireEvent.changeText(screen.getByLabelText('Why these costs'), 'At what the spool cost me.')
  fireEvent.press(screen.getByText('Add printer'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/printers',
      expect.objectContaining({ postcode: '2042', filament_cents_per_g: 12, rate_note: 'At what the spool cost me.' })
    )
  )
})

it('R17 says no rate is free and sends null', async () => {
  mockPost.mockResolvedValue({})
  render(<AddPrinterScreen />)
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Ender')
  fireEvent.press(screen.getByText('Add printer'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ filament_cents_per_g: null, rate_note: null }))
  )
})

it('refuses a rate that is not dollars, and sends nothing', () => {
  render(<AddPrinterScreen />)
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Ender')
  fireEvent.changeText(screen.getByLabelText('Dollars per gram'), '12c')
  fireEvent.press(screen.getByText('Add printer'))
  expect(screen.getByText('Filament cost is dollars per gram, like 0.12.')).toBeTruthy()
  expect(mockPost).not.toHaveBeenCalled()
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('lifts Add printer one gutter above the home indicator', () => {
  render(<AddPrinterScreen />)
  expect(paddingBottomOf(screen.getByTestId('add-printer-footer'))).toBe(CLEARANCE)
})
