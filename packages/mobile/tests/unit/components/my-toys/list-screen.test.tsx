// packages/mobile/tests/unit/components/my-toys/list-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MyToysListScreen } from '../../../../components/my-toys/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — standing in with a plain mount-time useEffect is
// enough to exercise the refetch-on-focus wiring itself, same as
// my-tutorials/list-screen.test.tsx.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => mockUseCapabilities(),
}))

function caps(over: object) {
  return {
    caps: {
      profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' },
      isAdmin: false,
      ledOrgs: [],
      unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
      exchangeActions: 0,
      ...over,
    },
    loading: false,
    refresh: jest.fn(),
  }
}

const toy = (over: object) => ({
  id: 'toy1',
  owner_id: 'viewer1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: null,
  condition: 8,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'draft',
  offer_type: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const tx = (over: object) => ({
  id: 'tx1',
  toy_id: 'toy1',
  offered_toy_id: null,
  type: 'donation',
  status: 'requested',
  requester_id: 'requester1',
  owner_id: 'viewer1',
  owner_org_id: null,
  owner_code: null,
  requester_code: null,
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  pickup_line1: null,
  pickup_suburb: null,
  pickup_state: null,
  pickup_postcode: null,
  pickup_instructions: null,
  created_at: '',
  updated_at: '',
  toy_name: 'Bubble machine',
  offered_toy_name: null,
  other_party_name: 'A requester',
  acting_for_org_name: null,
  blocked_by_rival_accept: false,
  last_message: null,
  ...over,
})

// Two independent apiClient.get calls, routed by path — same convention as
// toy-detail-screen.test.tsx's mockEndpoints.
function mockEndpoints({
  toys = Promise.resolve([]),
  transactions = Promise.resolve([]),
}: { toys?: Promise<unknown>; transactions?: Promise<unknown> } = {}) {
  mockGet.mockImplementation((p: string) => (p === '/api/toys' ? toys : transactions))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps({}))
  mockEndpoints()
})

describe('MyToysListScreen', () => {
  it('fetches the caller\'s toys and transactions', async () => {
    mockEndpoints({ toys: Promise.resolve([toy({})]) })
    render(<MyToysListScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toys')
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions')
  })

  it('shows the status badge, the meter line with condition and offer, for each status', async () => {
    mockEndpoints({
      toys: Promise.resolve([
        toy({ id: 't1', name: 'Bubble machine', status: 'draft', condition: 8, offer_type: null }),
        toy({ id: 't2', name: 'Switch puzzle', status: 'published', condition: 6, offer_type: 'exchange' }),
      ]),
    })
    render(<MyToysListScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('DRAFT', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByText('8/10 · Not offered yet', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByText('PUBLISHED', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByText('6/10 · Offered as Exchange', { includeHiddenElements: true })).toBeTruthy()
  })

  it('shows a switch-adapted badge only when the toy is switch-adapted', async () => {
    mockEndpoints({
      toys: Promise.resolve([
        toy({ id: 't1', name: 'Bubble machine', switch_adapted: true }),
        toy({ id: 't2', name: 'Switch puzzle', switch_adapted: false }),
      ]),
    })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getAllByText('SWITCH-ADAPTED', { includeHiddenElements: true })).toHaveLength(1)
  })

  it('shows the donation-or-exchange offer line for "both"', async () => {
    mockEndpoints({ toys: Promise.resolve([toy({ offer_type: 'both', condition: 5 })]) })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(
      screen.getByText('5/10 · Offered as Donation or exchange', { includeHiddenElements: true })
    ).toBeTruthy()
  })

  it('shows the waiting count as a chip only for owner-side requested transactions, grouped by toy', async () => {
    mockEndpoints({
      toys: Promise.resolve([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch puzzle' })]),
      transactions: Promise.resolve([
        tx({ id: 'tx1', toy_id: 't1', status: 'requested', owner_id: 'viewer1', requester_id: 'r1' }),
        tx({ id: 'tx2', toy_id: 't1', status: 'requested', owner_id: 'viewer1', requester_id: 'r2' }),
        // Same toy, but already accepted — must not add to the waiting count.
        tx({ id: 'tx3', toy_id: 't1', status: 'accepted', owner_id: 'viewer1', requester_id: 'r3' }),
        // Requested, but the viewer is the REQUESTER here, not the owner side —
        // isOwnerSide must exclude it even though the toy_id coincides.
        tx({ id: 'tx4', toy_id: 't2', status: 'requested', owner_id: 'someoneElse', requester_id: 'viewer1' }),
      ]),
    })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    // The chip is inside the row's own accessible AnimatedPressable
    // container, which swallows any label set on a child — the count has to
    // ride in the row's accessibilityHint (by item's own accessibilityLabel,
    // Bubble machine) to reach a screen reader at all.
    expect(screen.getByLabelText('Bubble machine').props.accessibilityHint).toContain('2 requests waiting.')
    expect(screen.getByText('2')).toBeTruthy()
    // Toy t2 has no owner-side requested transactions, so its hint carries
    // no waiting count.
    expect(screen.getByLabelText('Switch puzzle').props.accessibilityHint).not.toMatch(/request.*waiting/)
  })

  it('counts an org toy as owner-side when the viewer leads that organisation', async () => {
    mockUseCapabilities.mockReturnValue(caps({ ledOrgs: [{ id: 'org1', name: 'TAD Australia' }] }))
    mockEndpoints({
      toys: Promise.resolve([toy({ id: 't1', name: 'Bubble machine', owner_id: null, owner_org_id: 'org1' })]),
      transactions: Promise.resolve([
        tx({ id: 'tx1', toy_id: 't1', status: 'requested', owner_id: null, owner_org_id: 'org1', requester_id: 'r1' }),
      ]),
    })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByLabelText('Bubble machine').props.accessibilityHint).toContain('1 request waiting.')
  })

  it('pushes to the toy on tapping an active row', async () => {
    mockEndpoints({ toys: Promise.resolve([toy({ id: 't1', name: 'Bubble machine' })]) })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByText('Bubble machine'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/toys/[id]', params: { id: 't1' } })
  })

  it('links to Add a toy', async () => {
    mockEndpoints({ toys: Promise.resolve([toy({ id: 't1', name: 'Bubble machine' })]) })
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByLabelText('+ Add a toy'))
    expect(mockPush).toHaveBeenCalledWith('/toys/new')
  })

  it('invites the first toy when there are none yet', async () => {
    mockEndpoints({ toys: Promise.resolve([]) })
    render(<MyToysListScreen />)
    expect(await screen.findByText(/first/i)).toBeTruthy()
  })

  it('shows an error message when the fetch rejects', async () => {
    mockEndpoints({ toys: Promise.reject(new Error('API GET failed with status 500')) })
    render(<MyToysListScreen />)
    await waitFor(() => expect(screen.getByText("Couldn't load your toys.")).toBeTruthy())
  })
})
