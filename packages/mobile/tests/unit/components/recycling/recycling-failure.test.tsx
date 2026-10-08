// Recycling when the lists fail to load: says so, Try again re-reads, nothing hits console.error.
// journeys: V04
import { render, screen, fireEvent } from '@testing-library/react-native'
import { RecyclingScreen } from '../../../../components/recycling/recycling-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))

const ORG = {
  id: 'north', name: 'Northside Therapy', status: 'active', suburb: 'Crows Nest', state: 'NSW', recycling_materials: ['PLA', 'PETG'],
  recycling_note: null, recycling_machines: [], recycling_forms: [], recycling_min_kg: null, recycling_max_kg: null,
  recycling_turnaround: null, recycling_gives: 'credit', recycling_hours: null, recycling_door: null,
}

afterEach(() => jest.restoreAllMocks())

it('says recycling could not load, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((path: string) =>
    offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve(path === '/api/public/organizations' ? [ORG] : [])
  )
  render(<RecyclingScreen />)
  expect(await screen.findByText("Couldn't load recycling — try again.")).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Northside Therapy')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
