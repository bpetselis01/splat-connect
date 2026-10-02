import { render, screen } from '@testing-library/react-native'
import { BuildThreadScreen } from '../../../../components/builds/build-thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
jest.mock('expo-image-picker', () => ({}))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) } },
}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }
})
const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const as = (id: string) => ({
  caps: { profile: { id, name: 'Viewer', role: 'contributor' }, isAdmin: false, ledOrgs: [], unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0 },
  loading: false,
  refresh: jest.fn(),
})

const build = {
  id: 'b1', type: 'build', status: 'accepted', toy_id: null, offered_toy_id: null, requester_id: 'fam', owner_id: 'maker',
  owner_org_id: null, owner_code: null, requester_code: null, owner_confirmed_at: null, requester_confirmed_at: null,
  pickup_line1: null, pickup_suburb: null, pickup_state: null, pickup_postcode: null, pickup_instructions: null,
  tutorial_id: 'g1', tutorial_title: 'Bubble machine', build_brief: 'A bubble machine for Leo', travel_km: null, urgency: null,
  child_label: null, requester_suburb: 'Newtown', family_has_toy: false, working_photo_url: null, work_approved_at: null,
  owner_name: 'Tom Beattie', requester_name: 'Sam', toy_name: '', offered_toy_name: null, blocked_by_rival_accept: false,
  received_toy: null, messages: [], created_at: '', updated_at: '',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    p === '/api/toy-transactions/b1' ? Promise.resolve(build) : Promise.resolve({ lines: [], settlement: null })
  )
})

it('gives the maker the parts list to fill in', async () => {
  mockUseCapabilities.mockReturnValue(as('maker'))
  render(<BuildThreadScreen id="b1" />)
  expect(await screen.findByText('Parts you bought for this build')).toBeTruthy()
  expect(screen.getByText('The family covers parts, never your time. Itemise what you bought and mark each line.')).toBeTruthy()
})

it('shows the family what the build costs them, in the maker’s name', async () => {
  mockUseCapabilities.mockReturnValue(as('fam'))
  render(<BuildThreadScreen id="b1" />)
  expect(await screen.findByText('What this build costs you')).toBeTruthy()
  expect(screen.getByText('Tom Beattie gives the time and the tools free — these are the parts they bought.')).toBeTruthy()
  expect(screen.getByText('Nothing to pay')).toBeTruthy()
})
