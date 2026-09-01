// packages/mobile/tests/unit/components/exchanges/list-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ExchangesListScreen } from '../../../../components/exchanges/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
const mockSetParams = jest.fn()
let mockParams: Record<string, string | undefined> = {}
// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — standing in with a plain mount-time useEffect is
// enough to exercise the refetch-on-focus wiring itself, same as
// my-toys/list-screen.test.tsx.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    useLocalSearchParams: () => mockParams,
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
  pickup_instructions_note: null,
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

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockUseCapabilities.mockReturnValue(caps({}))
  mockGet.mockResolvedValue([])
})

describe('ExchangesListScreen', () => {
  it('splits requested/accepted into Active and everything else into History', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', status: 'requested', toy_name: 'Bubble machine' }),
      tx({ id: 'tx2', status: 'accepted', toy_name: 'Switch puzzle' }),
      tx({ id: 'tx3', status: 'completed', toy_name: 'Head switch' }),
      tx({ id: 'tx4', status: 'withdrawn', toy_name: 'Fidget cube' }),
    ])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions')
  })

  it('marks a requested transaction needing the owner\'s answer with the waiting label', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', status: 'requested', owner_id: 'viewer1', requester_id: 'r1' }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Waiting on you — accept or decline')).toBeTruthy()
  })

  it('marks an accepted donation needing the owner\'s confirmation with the confirm label', async () => {
    mockGet.mockResolvedValue([
      tx({
        id: 'tx1',
        status: 'accepted',
        type: 'donation',
        owner_id: 'viewer1',
        requester_id: 'r1',
        owner_confirmed_at: null,
      }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Waiting on you — confirm the handoff')).toBeTruthy()
  })

  it('does not mark a requested transaction the viewer is only the requester on', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', status: 'requested', owner_id: 'someoneElse', requester_id: 'viewer1' }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByText('Waiting on you — accept or decline')).toBeNull()
  })

  it('marks an org-owned request needing action when the viewer leads that organisation', async () => {
    mockUseCapabilities.mockReturnValue(caps({ ledOrgs: [{ id: 'org1', name: 'TAD Australia' }] }))
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', status: 'requested', owner_id: null, owner_org_id: 'org1', requester_id: 'r1' }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Waiting on you — accept or decline')).toBeTruthy()
  })

  it('names the counterparty from the requester\'s name on the owner side, and shows the exchange toy', async () => {
    mockGet.mockResolvedValue([
      tx({
        id: 'tx1',
        type: 'exchange',
        toy_name: 'Bubble machine',
        offered_toy_name: 'Fidget cube',
        other_party_name: 'Jamie',
      }),
    ])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Bubble machine ⇄ Fidget cube')).toBeTruthy()
    expect(screen.getByText('Exchange with Jamie')).toBeTruthy()
  })

  it('names the counterparty from the owner or org name on the requester side', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', type: 'donation', owner_id: 'someoneElse', requester_id: 'viewer1', other_party_name: 'TAD Australia' }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Donation with TAD Australia')).toBeTruthy()
  })

  it('shows "On behalf of" the organisation when the viewer is acting as an org leader, and omits it otherwise', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', acting_for_org_name: 'TAD Australia' }),
      tx({ id: 'tx2', toy_name: 'Switch puzzle', acting_for_org_name: null }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('On behalf of TAD Australia')).toBeTruthy()
    expect(screen.queryAllByText(/On behalf of/)).toHaveLength(1)
  })

  it('shows the rival-blocked note, mirroring web\'s copy', async () => {
    mockGet.mockResolvedValue([tx({ id: 'tx1', blocked_by_rival_accept: true })])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Locked — another request accepted')).toBeTruthy()
  })

  it('shows a muted one-line preview of the last message when present', async () => {
    mockGet.mockResolvedValue([
      tx({
        id: 'tx1',
        last_message: { body: 'See you Saturday!', sender_id: 'r1', kind: 'user', created_at: '2026-01-01' },
      }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('See you Saturday!')).toBeTruthy()
  })

  it('prefixes the preview with "You:" when the viewer sent the last message', async () => {
    mockGet.mockResolvedValue([
      tx({
        id: 'tx1',
        last_message: { body: 'See you Saturday!', sender_id: 'viewer1', kind: 'user', created_at: '2026-01-01' },
      }),
    ])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('You: See you Saturday!')).toBeTruthy()
  })

  it('filters to the toy named in the ?toy= param, and shows a header chip naming it', async () => {
    mockParams = { toy: 'toy1' }
    mockGet.mockResolvedValue([
      tx({ id: 'tx1', toy_id: 'toy1', toy_name: 'Bubble machine' }),
      tx({ id: 'tx2', toy_id: 'toy2', toy_name: 'Switch puzzle' }),
    ])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.queryByText('Switch puzzle')).toBeNull()
    expect(screen.getByText('Offers on Bubble machine ✕')).toBeTruthy()
  })

  it('clears the ?toy= filter via router.setParams when the chip is pressed', async () => {
    mockParams = { toy: 'toy1' }
    mockGet.mockResolvedValue([tx({ id: 'tx1', toy_id: 'toy1', toy_name: 'Bubble machine' })])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByText('Offers on Bubble machine ✕'))
    expect(mockSetParams).toHaveBeenCalledWith({ toy: undefined })
  })

  it('pushes to the exchange thread on tapping a row', async () => {
    mockGet.mockResolvedValue([tx({ id: 'tx1', toy_name: 'Bubble machine' })])
    render(<ExchangesListScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByLabelText('Bubble machine with A requester'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx1')
  })

  it('shows a skeleton while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<ExchangesListScreen />)
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0)
  })

  it('shows an error message when the fetch rejects', async () => {
    mockGet.mockRejectedValue(new Error('API GET failed with status 500'))
    render(<ExchangesListScreen />)
    await waitFor(() => expect(screen.getByText("Couldn't load your exchanges.")).toBeTruthy())
  })

  it('invites browsing the toy library when there are no exchanges yet', async () => {
    mockGet.mockResolvedValue([])
    render(<ExchangesListScreen />)
    expect(await screen.findByText(/No.*exchange/i)).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Browse the toy library'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library')
  })
})
