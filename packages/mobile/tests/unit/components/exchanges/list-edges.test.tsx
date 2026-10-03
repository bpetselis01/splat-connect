// The exchanges list with every kind of row and every awkward bit of data it
// can be handed. The split and badges live in list-screen.test.tsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import { ExchangesListScreen } from '../../../../components/exchanges/list-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
const mockSetParams = jest.fn()
let mockParams: Record<string, string | undefined> = {}
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    useLocalSearchParams: () => mockParams,
  }
})
let mockCaps: object | null
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false, refresh: jest.fn() }) }))

const tx = (over: object = {}) => ({
  id: 'tx1', toy_id: 'toy1', offered_toy_id: null, type: 'donation', status: 'requested', requester_id: 'fam', owner_id: 'me', owner_org_id: null,
  owner_confirmed_at: null, requester_confirmed_at: null, working_photo_url: null, work_approved_at: null, printing_started_at: null, ready_at: null,
  created_at: new Date().toISOString(), updated_at: '', toy_name: 'Bubble machine', toy_cover_photo_url: null, offered_toy_name: null, tutorial_title: null,
  other_party_name: 'Jamie', acting_for_org_name: null, blocked_by_rival_accept: false, last_message: null, ...over,
})
const msg = (over: object = {}) => ({ body: 'Hello', sender_id: 'fam', kind: 'user', created_at: '', ...over })

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockCaps = { profile: { id: 'me', name: 'Me' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 }
  mockGet.mockResolvedValue([])
})

describe('which rows go where', () => {
  it('shows only History, with no Active heading, when everything is settled', async () => {
    mockGet.mockResolvedValue([tx({ id: 'a', status: 'completed' }), tx({ id: 'b', status: 'rejected', toy_name: 'Other toy' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('History')).toBeTruthy()
    expect(screen.queryByText('Active')).toBeNull()
  })

  it('shows only Active, with no History heading, when nothing is settled', async () => {
    mockGet.mockResolvedValue([tx()])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Active')).toBeTruthy()
    expect(screen.queryByText('History')).toBeNull()
  })

  it('opens a build in the build thread and a toy in the exchange thread', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'b1', type: 'build', toy_id: null, toy_name: '', tutorial_title: 'Switch mount' }),
      tx({ id: 'd1', toy_name: 'Drum' }),
    ])
    render(<ExchangesListScreen />)
    fireEvent.press(await screen.findByLabelText('Switch mount with Jamie'))
    expect(mockPush).toHaveBeenLastCalledWith('/exchanges/build/b1')
    fireEvent.press(screen.getByLabelText('Drum with Jamie'))
    expect(mockPush).toHaveBeenLastCalledWith('/exchanges/d1')
  })

  it('names an unclaimed build by its guide and says it is waiting for a maker', async () => {
    mockGet.mockResolvedValue([tx({ type: 'build', toy_id: null, toy_name: '', tutorial_title: 'Switch mount', other_party_name: '' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Switch mount')).toBeTruthy()
    expect(screen.getByText(/Build · waiting for a maker/)).toBeTruthy()
  })

  it('names a build with no guide title as A build', async () => {
    mockGet.mockResolvedValue([tx({ type: 'build', toy_id: null, toy_name: '', tutorial_title: null })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('A build')).toBeTruthy()
  })

  it('titles a swap with both toys', async () => {
    mockGet.mockResolvedValue([tx({ type: 'exchange', offered_toy_name: 'Switch car' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Bubble machine ⇄ Switch car')).toBeTruthy()
  })

  it('moves an expired print request to History with an Expired badge', async () => {
    const old = new Date(Date.now() - 8 * 864e5).toISOString()
    mockGet.mockResolvedValue([tx({ type: 'print', created_at: old, toy_name: '' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText('Expired')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
    expect(screen.queryByText('Active')).toBeNull()
  })
})

describe('the last word on a row', () => {
  it('prefixes only the viewer\'s own user messages with You:', async () => {
    mockGet.mockResolvedValue([
      tx({ id: 'a', status: 'completed', toy_name: 'A', last_message: msg({ sender_id: 'me', body: 'Mine' }) }),
      tx({ id: 'b', status: 'completed', toy_name: 'B', last_message: msg({ sender_id: 'me', kind: 'system', body: 'System line' }) }),
      tx({ id: 'c', status: 'completed', toy_name: 'C', last_message: msg({ body: 'Theirs' }) }),
    ])
    render(<ExchangesListScreen />)
    expect(await screen.findByText(/Donation with Jamie · You: Mine/)).toBeTruthy()
    expect(screen.getByText(/Donation with Jamie · System line/)).toBeTruthy()
    expect(screen.getByText(/Donation with Jamie · Theirs/)).toBeTruthy()
  })

  it.each([
    ['a long message', 'word '.repeat(600).trim()],
    ['emoji', '🧸🦄 thank you!!'],
    ['RTL text', 'شكرا جزيلا'],
    ['markup', '<b>bold</b> & "quoted"'],
  ])('draws %s from the other side whole', async (_what, body) => {
    mockGet.mockResolvedValue([tx({ status: 'completed', last_message: msg({ body }) })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText(new RegExp(body.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
  })

  it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)))('draws a toy and a counterparty named with $label text', async ({ value }) => {
    mockGet.mockResolvedValue([tx({ toy_name: value, other_party_name: value })])
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText(`${value} with ${value}`)).toBeTruthy()
  })

  it('shows the lock in place of the last message when a rival accept holds the toy', async () => {
    mockGet.mockResolvedValue([tx({ blocked_by_rival_accept: true, last_message: msg({ body: 'Still keen' }) })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText(/Locked — another request accepted/)).toBeTruthy()
    expect(screen.queryByText(/Still keen/)).toBeNull()
  })

  it('shows the action in place of the last message when the viewer owes one', async () => {
    mockGet.mockResolvedValue([tx({ last_message: msg({ body: 'Still keen' }) })])
    render(<ExchangesListScreen />)
    expect(await screen.findByText(/Waiting on you — accept or decline/)).toBeTruthy()
    expect(screen.queryByText(/Still keen/)).toBeNull()
  })

  it('draws no action line before capabilities are known', async () => {
    mockCaps = null
    mockGet.mockResolvedValue([tx()])
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText('Bubble machine with Jamie')).toBeTruthy()
    expect(screen.queryByText(/Waiting on you/)).toBeNull()
  })
})

describe('size and refresh', () => {
  it('draws one row', async () => {
    mockGet.mockResolvedValue([tx()])
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText('Bubble machine with Jamie')).toBeTruthy()
  })

  it('draws a long history', async () => {
    mockGet.mockResolvedValue(Array.from({ length: 120 }, (_, i) => tx({ id: `t${i}`, status: 'completed', toy_name: `Toy ${i}` })))
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText('Toy 0 with Jamie')).toBeTruthy()
    expect(screen.getByLabelText('Toy 119 with Jamie')).toBeTruthy()
  })

  it('offers Try again after a failed load, and shows the rows once it works', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<ExchangesListScreen />)
    expect(await screen.findByText("Couldn't load your exchanges.")).toBeTruthy()
    mockGet.mockResolvedValue([tx()])
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByLabelText('Bubble machine with Jamie')).toBeTruthy()
  })

  it('keeps the rows while a pull to refresh runs, then shows the new ones', async () => {
    mockGet.mockResolvedValue([tx({ toy_name: 'First' })])
    render(<ExchangesListScreen />)
    await screen.findByLabelText('First with Jamie')
    await act(async () => {})
    let resolve!: (v: object[]) => void
    mockGet.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    act(() => screen.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh())
    expect(screen.getByLabelText('First with Jamie')).toBeTruthy()
    await act(async () => resolve([tx({ toy_name: 'Second' })]))
    await waitFor(() => expect(screen.getByLabelText('Second with Jamie')).toBeTruthy())
    expect(screen.queryByLabelText('First with Jamie')).toBeNull()
  })

  it('names the filter chip "this toy" when no row carries the toy\'s name', async () => {
    mockParams = { toy: 'gone' }
    mockGet.mockResolvedValue([tx({ toy_id: 'other' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText('Clear filter: offers on this toy')).toBeTruthy()
  })

  it('names the filter chip after a toy with a markup name', async () => {
    mockParams = { toy: 'toy1' }
    mockGet.mockResolvedValue([tx({ toy_name: '<b>Drum</b> & "co"' })])
    render(<ExchangesListScreen />)
    expect(await screen.findByLabelText('Clear filter: offers on <b>Drum</b> & "co"')).toBeTruthy()
  })
})
