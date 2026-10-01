import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { RequestPrintScreen } from '../../../../components/printing/request-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }))

const GUIDE = {
  id: 'g1',
  title: 'Switch mount',
  stl_files: [
    { id: 's1', filename: 'mount.stl', print_minutes: 60, filament_grams: 10, material: 'PETG' },
    { id: 's2', filename: 'clip.stl', print_minutes: 20, filament_grams: 4, material: 'PETG' },
  ],
}
const PRINTER = { id: 'p1', owner_name: 'Tom B.', org_name: null, filament_cents_per_g: null }

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockGet.mockImplementation((path: string) => Promise.resolve(path === '/api/printers' ? [PRINTER] : GUIDE))
})

it('sends a quantity per part', async () => {
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  fireEvent.press(await screen.findByLabelText('More mount.stl'))
  fireEvent.press(screen.getByLabelText('More mount.stl'))
  expect(screen.getByText('×3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Fewer mount.stl'))
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/toy-transactions/print',
      expect.objectContaining({
        files: [
          { stl_file_id: 's1', quantity: 2 },
          { stl_file_id: 's2', quantity: 1 },
        ],
      })
    )
  )
})
