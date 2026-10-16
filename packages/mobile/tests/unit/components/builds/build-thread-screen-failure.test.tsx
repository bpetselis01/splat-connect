// The build thread when its first read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: K06 K07 K08 K09 K10 K11 K12 K13
import { render, screen, fireEvent } from '@testing-library/react-native'
import { BuildThreadScreen } from '../../../../components/builds/build-thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: null }) }) } } }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: jest.fn(), notify: jest.fn() }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'fam' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))
jest.mock('../../../../components/exchanges/cost-panel', () => ({ CostPanel: () => null }))

const build = {
  id: 'b1', type: 'build', status: 'requested', toy_id: null, offered_toy_id: null, requester_id: 'fam', owner_id: null,
  owner_org_id: null, owner_code: '111111', requester_code: '222222', owner_confirmed_at: null, requester_confirmed_at: null,
  pickup_line1: null, pickup_suburb: null, pickup_state: null, pickup_postcode: null, pickup_instructions: null,
  tutorial_id: 'g1', tutorial_title: 'Bubble machine', build_brief: null, travel_km: null, urgency: null,
  requester_suburb: 'Newtown', family_has_toy: false, working_photo_url: null, work_approved_at: null, owner_name: 'Tom Beattie',
  requester_name: 'Sam', toy_name: '', offered_toy_name: null, blocked_by_rival_accept: false, received_toy: null, messages: [],
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

afterEach(() => jest.restoreAllMocks())

it('says the build could not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  mockGet.mockReset().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(build)
  render(<BuildThreadScreen id="b1" />)
  expect(await screen.findByText("Couldn't load this build.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
