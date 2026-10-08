// Request a print when the guide or printer read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: R03
import { render, screen, fireEvent } from '@testing-library/react-native'
import { RequestPrintScreen } from '../../../../components/printing/request-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }))

const GUIDE = { id: 'g1', title: 'Switch mount', stl_files: [{ id: 's1', filename: 's1.stl', print_minutes: 60, filament_grams: 10, material: 'PETG' }] }
const PRINTER = { id: 'p1', owner_id: 'o1', owner_org_id: null, owner_name: 'Tom B.', org_name: null, filament_cents_per_g: null }

afterEach(() => jest.restoreAllMocks())

it('says the guide could not load offline, and Try again loads the form', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((path: string) =>
    offline
      ? Promise.reject(new Error('Network request failed'))
      : Promise.resolve(path === '/api/printers' ? [PRINTER] : path === '/api/organizations/recycling/credit' ? [] : GUIDE)
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  expect(await screen.findByText("Couldn't load this guide.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Send request')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
