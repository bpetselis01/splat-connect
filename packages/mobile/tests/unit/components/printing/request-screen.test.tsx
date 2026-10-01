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

it('names the estimate in the agree line, and falls back without a rate', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [{ ...PRINTER, filament_cents_per_g: 10 }, { id: 'p2', owner_name: 'Ann', org_name: null, filament_cents_per_g: 20 }]
        : GUIDE
    )
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p1', 'p2']} />)
  // 14 g at 10c and 20c a gram.
  expect(
    await screen.findByText(
      'I understand I cover the filament — about $1.40–$2.80 at the printer’s declared rate — and that I settle it with them, not through SPLAT.'
    )
  ).toBeTruthy()
})

it('keeps today’s line when no printer declared a rate', async () => {
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  expect(
    await screen.findByText('I understand I cover the filament, and that I settle it with the printer, not through SPLAT.')
  ).toBeTruthy()
})

it('keeps today’s line when one printer has a rate and another is free', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [{ ...PRINTER, filament_cents_per_g: 10 }, { id: 'p2', owner_name: 'Ann', org_name: null, filament_cents_per_g: null }]
        : GUIDE
    )
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p1', 'p2']} />)
  expect(await screen.findByText('I understand I cover the filament, and that I settle it with the printer, not through SPLAT.')).toBeTruthy()
})

it('multiplies by quantity', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/printers' ? [{ ...PRINTER, filament_cents_per_g: 10 }] : GUIDE)
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  fireEvent.press(await screen.findByLabelText('More mount.stl'))
  // (10 g × 2 + 4 g) × 10c
  expect(await screen.findByText(/about \$2\.40 at/)).toBeTruthy()
})

it('sends the customization answers that were picked', async () => {
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  expect(
    await screen.findByText('Physical dimensions we use to size printed mounts and brackets. Nothing here is required.')
  ).toBeTruthy()
  fireEvent.press(screen.getByText('20–40 cm'))
  fireEvent.press(screen.getByText('Floor stand'))
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/toy-transactions/print',
      expect.objectContaining({ fit_notes: { reach: '20–40 cm', mount: 'Floor stand' } })
    )
  )
})
