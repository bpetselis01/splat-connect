// Print for others when the printer read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: R14 R16
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintForOthersScreen } from '../../../../components/printing/offer-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-image-picker', () => ({}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), patch: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: jest.fn(),
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] } }),
}))

const machine = { id: 'Ender', name: 'Ender', owner_id: 'me', owner_org_id: null, org_name: null, materials: ['PETG'], bed_x: 220, accepting: true, capacity: 2, open_jobs: 0, notes: null }

afterEach(() => jest.restoreAllMocks())

it('says the printers could not load offline, and Try again loads them', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((path: string) =>
    offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve(path === '/api/printers/mine' ? [machine] : [])
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText("Couldn't load your printers.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Nothing waiting')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
