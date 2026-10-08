// An organisation profile when its load fails: says so, Try again re-reads, nothing hits console.error.
// journeys: P01
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgProfileScreen } from '../../../../components/organisation/org-profile-screen'
import { useAuth } from '../../../../lib/auth-context'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: 'u1', name: 'Priya Nair' } } }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), delete: jest.fn() } }))
jest.mock('../../../../lib/recents', () => ({ recordRecent: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const ORG = {
  id: 'o1', name: 'Northbank Makerspace', status: 'active', kind: 'University makerspace', suburb: 'Callaghan', state: 'NSW',
  created_at: '2024-03-01T00:00:00Z', verified_at: '2026-09-01T00:00:00Z', thanks_count: 2, about: 'Students adapting toys.',
  tutorialsBacked: [], tutorialsApproved: [], toysShared: [], toysDelivered: [],
  counts: { guidesBacked: 4, toysDelivered: 1, partsPrinted: 30, familiesHelped: 12 }, doors: [], fromFamilies: [], leaders: [],
}

afterEach(() => jest.restoreAllMocks())

it('says the organisation could not load, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  ;(useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'u1' } } })
  let offline = true
  mockGet.mockReset().mockImplementation((p: string) =>
    offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve(p.startsWith('/api/public') ? ORG : { leads: false, following: false, thanks: null, conversation_id: null })
  )
  render(<OrgProfileScreen id="o1" />)
  expect(await screen.findByText("Couldn't load this organisation.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Northbank Makerspace')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
