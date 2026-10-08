// Find a printer when the printer list cannot be read: says so, Try again re-reads, nothing hits console.error.
// journeys: R01 R02
import { render, screen, fireEvent } from '@testing-library/react-native'
import { FindPrinterScreen } from '../../../../components/printing/find-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] }, loading: false }),
}))

const printer = {
  id: 'a', owner_id: 'o', owner_org_id: null, owner_name: 'Maker A', org_name: null, name: 'Prusa',
  materials: ['PETG'], bed_x: 220, bed_y: 220, bed_z: 220, accepting: true, capacity: 2, open_jobs: 0, suburb: null, state: null,
}

afterEach(() => jest.restoreAllMocks())

it('says printers could not load offline, and Try again loads them', async () => {
  const err = jest.spyOn(console, 'error')
  mockGet.mockReset().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue([printer])
  render(<FindPrinterScreen />)
  expect(await screen.findByText("Couldn't load printers.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Maker A')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
