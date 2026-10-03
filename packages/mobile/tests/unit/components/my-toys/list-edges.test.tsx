// My toys with every shape of shelf: one toy, a hundred, odd names, a failing
// load, a shelf emptied by giving everything away. Ordinary journeys: list-screen.test.tsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import { MyToysListScreen } from '../../../../components/my-toys/list-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
let mockCaps: object | null
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false, refresh: jest.fn() }) }))

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 8, switch_adapted: false,
  photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'draft', offer_type: null, created_at: '', updated_at: '', ...over,
})
const tx = (over: object = {}) => ({
  id: 'tx1', toy_id: 't1', offered_toy_id: null, type: 'donation', status: 'requested', requester_id: 'fam', owner_id: 'me', owner_org_id: null,
  toy_name: 'Bubble machine', toy_cover_photo_url: null, offered_toy_name: null, offered_toy_cover_photo_url: null, other_party_name: 'Fam',
  updated_at: '2026-10-01T00:00:00Z', blocked_by_rival_accept: false, ...over,
})
const serve = (toys: object[], txs: object[] = []) => mockGet.mockImplementation((p: string) => Promise.resolve(p === '/api/toys' ? toys : txs))

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps = { profile: { id: 'me', name: 'Me' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 }
  serve([])
})

describe('rows', () => {
  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws a toy named with $label text', async ({ value }) => {
    serve([toy({ name: value })])
    render(<MyToysListScreen />)
    expect(await screen.findByText(value)).toBeTruthy()
  })

  it('draws a hundred toys', async () => {
    serve(Array.from({ length: 100 }, (_, i) => toy({ id: `t${i}`, name: `Toy ${i}` })))
    render(<MyToysListScreen />)
    expect(await screen.findByLabelText('All, 100')).toBeTruthy()
  })

  it.each([[0, '0/10'], [10, '10/10']])('shows condition %i as %s', async (condition, text) => {
    serve([toy({ condition })])
    render(<MyToysListScreen />)
    expect(await screen.findByText(new RegExp(`^${text.replace('/', '\\/')} · `))).toBeTruthy()
  })

  it('says one request waiting, singular, and twelve, plural', async () => {
    serve([toy({ id: 'a', name: 'A' }), toy({ id: 'b', name: 'B' })], [tx({ toy_id: 'a' }), ...Array.from({ length: 12 }, (_, i) => tx({ id: `x${i}`, toy_id: 'b' }))])
    render(<MyToysListScreen />)
    expect(await screen.findByText(/· 1 request waiting/)).toBeTruthy()
    expect(screen.getByText(/· 12 requests waiting/)).toBeTruthy()
  })

  it('does not count a request on a toy that is not on the shelf, or one already answered', async () => {
    serve([toy()], [tx({ toy_id: 'other' }), tx({ id: 'b', status: 'accepted' }), tx({ id: 'c', status: 'rejected' }), tx({ id: 'd', toy_id: null, type: 'build' })])
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByText(/waiting/)).toBeNull()
    expect(screen.getByLabelText('Needs you, 0')).toBeTruthy()
  })

  it('counts a request the viewer made as nothing waiting on them', async () => {
    serve([toy()], [tx({ owner_id: 'someone', requester_id: 'me' })])
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByText(/waiting/)).toBeNull()
  })

  it('counts nothing as waiting before capabilities are known', async () => {
    mockCaps = null
    serve([toy()], [tx()])
    render(<MyToysListScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByText(/waiting/)).toBeNull()
  })
})

describe('given away', () => {
  const gone = (over: object = {}) => tx({ status: 'completed', toy_id: 'gone1', toy_name: 'Old drum', other_party_name: 'Fam', ...over })

  it('lists given-away toys with an empty shelf, saying the shelf is empty too', async () => {
    serve([], [gone()])
    render(<MyToysListScreen />)
    expect(await screen.findByText('Old drum')).toBeTruthy()
    expect(screen.getByText('No toys on your shelf right now.')).toBeTruthy()
    expect(screen.getByText('Given away')).toBeTruthy()
  })

  it('shows the first-toy invitation, not an empty Given away, for a person who has given nothing', async () => {
    serve([], [tx({ status: 'completed', owner_id: 'someone', requester_id: 'me' })])
    render(<MyToysListScreen />)
    expect(await screen.findByText('No toys yet')).toBeTruthy()
    expect(screen.queryByText('Given away')).toBeNull()
  })

  it('keeps a given-away row when the stage filter shows nothing', async () => {
    serve([toy()], [gone()])
    render(<MyToysListScreen />)
    await screen.findByText('Old drum')
    fireEvent.press(screen.getByLabelText('Live, 0'))
    expect(screen.getByText('Nothing at that stage.')).toBeTruthy()
    expect(screen.getByText('Old drum')).toBeTruthy()
  })

  it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)))('names a recipient with $label text', async ({ value }) => {
    serve([], [gone({ other_party_name: value })])
    render(<MyToysListScreen />)
    expect(await screen.findByText(new RegExp(`Donated to ${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · `))).toBeTruthy()
  })

  it('shows two handovers newest first', async () => {
    serve([], [gone({ id: 'old', toy_name: 'Older', updated_at: '2026-01-01T00:00:00Z' }), gone({ id: 'new', toy_name: 'Newer', updated_at: '2026-09-01T00:00:00Z' })])
    render(<MyToysListScreen />)
    await screen.findByText('Newer')
    const titles = screen.getAllByText(/^(Newer|Older)$/).map((n) => n.props.children)
    expect(titles).toEqual(['Newer', 'Older'])
  })
})

describe('failing and refreshing', () => {
  it('says the shelf did not load when only the transactions fail, then recovers on Try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockImplementation((p: string) => (p === '/api/toys' ? Promise.resolve([toy()]) : Promise.reject(new TypeError('Network request failed'))))
    render(<MyToysListScreen />)
    expect(await screen.findByText("Couldn't load your toys.")).toBeTruthy()
    serve([toy()])
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it('keeps the chosen stage across a pull to refresh', async () => {
    serve([toy({ id: 'a', name: 'Live one', status: 'published' }), toy({ id: 'b', name: 'Draft one' })])
    render(<MyToysListScreen />)
    await screen.findByText('Live one')
    fireEvent.press(screen.getByLabelText('Live, 1'))
    await act(async () => screen.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh())
    await waitFor(() => expect(screen.getByText('Live one')).toBeTruthy())
    expect(screen.queryByText('Draft one')).toBeNull()
  })

  it('sends the + Add a toy button to the add screen from the empty state too', async () => {
    render(<MyToysListScreen />)
    await screen.findByText('No toys yet')
    fireEvent.press(screen.getAllByLabelText('+ Add a toy')[0])
    expect(mockPush).toHaveBeenCalledWith('/toys/new')
  })
})
