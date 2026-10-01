import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const caps = (ledOrgs: { id: string; name: string }[] = []) => ({
  caps: {
    profile: { id: 'me', name: 'Sam', role: 'contributor' },
    isAdmin: false,
    ledOrgs,
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Light-up drum', description: null, condition: 8,
  switch_adapted: true, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '2026-06-04T12:00:00Z', updated_at: '', ...over,
})

const request = (over: object = {}) => ({
  id: 'tx1', toy_id: 't1', type: 'donation', status: 'requested', requester_id: 'fam1', owner_id: 'me', owner_org_id: null,
  requester_name: 'Eastwood Special School', other_party_name: 'Eastwood Special School', blocked_by_rival_accept: false,
  last_message: { body: 'For a class of four who share one switch', sender_id: 'fam1', kind: 'user', created_at: '' },
  ...over,
})

/** Routes each GET; `inventory` is only read when `mine` lacks the toy. */
function serve({ mine = [toy()], inventory = [], txs = [] }: { mine?: object[]; inventory?: object[]; txs?: object[] } = {}) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/toys' ? Promise.resolve(mine)
    : p === '/api/toys/inventory' ? Promise.resolve(inventory)
    : p === '/api/toy-transactions' ? Promise.resolve(txs)
    : Promise.reject(new Error(`unexpected GET ${p}`))
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps())
})

describe('ToySummaryScreen', () => {
  it('leads with the listing and how many families have asked, and opens the editor', async () => {
    serve({ txs: [request(), request({ id: 'tx2', requester_name: 'Priya Nadarajah' }), request({ id: 'tx3', toy_id: 'other' })] })
    render(<ToySummaryScreen id="t1" />)
    expect(
      await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted. 2 families have asked for it.')
    ).toBeTruthy()
    expect(screen.getByText('Photos, condition, notes')).toBeTruthy()
    fireEvent.press(screen.getByText('Edit listing'))
    expect(mockPush).toHaveBeenCalledWith('/toys/t1/edit')
  })

  it("opens an organisation's toy from the inventory", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1', switch_adapted: false })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Light-up drum — listed 4 June, good condition.')).toBeTruthy()
  })

  it('says so when the toy is not yours', async () => {
    serve({ mine: [] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  })
})
