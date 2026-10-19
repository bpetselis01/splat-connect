// The exchange thread when its first read fails: says so, Try again re-reads, nothing hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ExchangeThreadScreen } from '../../../../components/exchanges/thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }
})
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: jest.fn(),
  useCapabilities: () => ({
    caps: { profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' }, isAdmin: false, ledOrgs: [], unread: { total: 0 }, exchangeActions: 0 },
    loading: false,
    refresh: jest.fn(),
  }),
}))

const detail = {
  id: 'tx1', toy_id: 'toy1', offered_toy_id: null, type: 'donation', status: 'requested',
  requester_id: 'requester1', owner_id: 'viewer1', owner_org_id: null, owner_code: null, requester_code: null,
  owner_confirmed_at: null, requester_confirmed_at: null, pickup_line1: null, pickup_suburb: null,
  pickup_state: null, pickup_postcode: null, pickup_instructions: null,
  created_at: '2026-08-30T01:00:00.000Z', updated_at: '2026-08-30T01:00:00.000Z',
  toy_name: 'Bubble machine', offered_toy_name: null, owner_name: 'Ash', requester_name: 'Jamie',
  blocked_by_rival_accept: false, received_toy: null, messages: [],
}

afterEach(() => jest.restoreAllMocks())

it('X02 says the exchange could not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  mockGet.mockReset().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(detail)
  render(<ExchangeThreadScreen id="tx1" />)
  expect(await screen.findByText("Couldn't load this exchange.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(/Bubble machine/)).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
