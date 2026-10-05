// Browsing the toy library with awkward search text, odd rows and a flaky
// network. The ordinary filters live in toy-library-screen.test.tsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
const mockCaps = { current: null as null | { profile: Record<string, unknown> } }
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockCaps.current, loading: false, refresh: jest.fn() }),
}))

const toy = (over: object = {}) => ({
  id: 'toy1', owner_id: 'u1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 8,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation',
  created_at: '2026-06-01T00:00:00Z', updated_at: '', profiles: { name: 'Jamie' }, organizations: null, ...over,
})
// Open the filter page, press each option, then Show: choices apply only then.
async function applyFilters(labels: string[]) {
  fireEvent.press(await screen.findByRole('button', { name: /^Filters/ }))
  for (const l of labels) fireEvent.press(screen.getByText(l))
  fireEvent.press(screen.getByText(/^Show \d+ toys?$/))
}
const search = (text: string) => fireEvent.changeText(screen.getByPlaceholderText('Search toys'), text)

// The screen also reads the parent's child profiles on mount; answer that by
// path so a queued toy-list response is never spent on it.
function toysInOrder(...replies: unknown[]) {
  const q = [...replies]
  mockGet.mockImplementation((path: string) => (path === '/api/child-profiles' ? Promise.resolve([]) : q.length ? Promise.resolve(q.shift()) : Promise.resolve([])))
}
beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
  mockGet.mockResolvedValue([])
})

describe('search text', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue([toy({ id: 'a', name: 'Bubble machine (large)' }), toy({ id: 'b', name: 'Zoë’s Drum' }), toy({ id: 'c', name: 'Car [red] .* 100%' })])
  })

  it.each([
    ['regex brackets', '[red]', 'Car [red] .* 100%'],
    ['regex dot star', '.*', 'Car [red] .* 100%'],
    ['an open parenthesis', '(large', 'Bubble machine (large)'],
    ['a percent sign', '100%', 'Car [red] .* 100%'],
    ['upper case', 'BUBBLE', 'Bubble machine (large)'],
    ['spaces around it', '   drum  ', 'Zoë’s Drum'],
    ['a diacritic', 'zoë', 'Zoë’s Drum'],
  ])('finds the toy for %s', async (_what, typed, expected) => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine (large)')
    search(typed)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('shows every toy again for a search of only spaces, without offering to clear filters', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine (large)')
    search('     ')
    expect(screen.getByText('3 toys · Newest first')).toBeTruthy()
    expect(screen.queryByText('Clear filters')).toBeNull()
  })

  it.each([
    ['markup', '<b>drum</b>'],
    ['quotes', 'say "hi" & \'bye\''],
    ['emoji', '🧸'],
    ['RTL', 'سارة'],
    ['a very long word', 'x'.repeat(500)],
  ])('says nothing matches %s, quoting it as typed', async (_what, typed) => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine (large)')
    search(typed)
    expect(await screen.findByText(`Nothing matches "${typed}". Try a different word, or clear the search.`)).toBeTruthy()
    expect(screen.getByText('0 toys · Newest first')).toBeTruthy()
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('3 toys · Newest first')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search toys').props.value).toBe('')
  })
})

describe('rows with unusual data', () => {
  it('says 0 toys and the plain empty line for an empty library, with no filter to clear', async () => {
    render(<ToyLibraryScreen />)
    expect(await screen.findByText('No toys here yet')).toBeTruthy()
    expect(screen.getByText('0 toys · Newest first')).toBeTruthy()
    expect(screen.getByText('Try removing a filter — new toys are added as they are shared.')).toBeTruthy()
    expect(screen.queryByText('Clear filters')).toBeNull()
  })

  it('says 1 toy, singular', async () => {
    mockGet.mockResolvedValue([toy()])
    render(<ToyLibraryScreen />)
    expect(await screen.findByText('1 toy · Newest first')).toBeTruthy()
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws a toy named with $label text and finds it by search', async ({ value }) => {
    mockGet.mockResolvedValue([toy({ name: value })])
    render(<ToyLibraryScreen />)
    expect(await screen.findByText(value)).toBeTruthy()
    search(value.toLowerCase().slice(0, 3))
    expect(screen.getByText(value)).toBeTruthy()
  })

  it('says None left on a person toy with no stock, and 0 available on an organisation toy', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 'p', name: 'Mine', quantity: 0 }),
      toy({ id: 'o', name: 'Theirs', owner_id: null, owner_org_id: 'o1', quantity: 0, profiles: null, organizations: { name: 'TAD' } }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Mine')
    expect(screen.getByText('None left', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByText('0 available', { includeHiddenElements: true })).toBeTruthy()
    await applyFilters(['Available now'])
    expect(screen.getByText('No toys here yet')).toBeTruthy()
  })

  it('names SPLAT as the holder in the hint for a toy with neither a person nor an organisation', async () => {
    mockGet.mockResolvedValue([toy({ profiles: null, organizations: null })])
    render(<ToyLibraryScreen />)
    expect((await screen.findByLabelText('Bubble machine')).props.accessibilityHint).toContain('Held by SPLAT')
  })

  it.each([
    [10, 'Like new'], [9, 'Like new'], [8, 'Good'], [7, 'Good'], [6, 'Well-loved'], [5, 'Well-loved'], [4, 'Needs a fix'], [0, 'Needs a fix'], [-1, 'Needs a fix'],
  ])('puts condition %i in the grade %s', async (condition, label) => {
    mockGet.mockResolvedValue([toy({ condition })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getAllByText(label, { includeHiddenElements: true }).length).toBeGreaterThan(0)
    await applyFilters([label])
    expect(screen.getByText('Bubble machine')).toBeTruthy()
  })

  it('orders newest first by date, and does not crash on a missing or unreadable date', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 'a', name: 'Old', created_at: '2026-01-01T00:00:00Z' }),
      toy({ id: 'b', name: 'Broken', created_at: '' }),
      toy({ id: 'c', name: 'New', created_at: '2026-09-01T00:00:00Z' }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Old')
    await applyFilters(['Newest'])
    expect(screen.getByText('3 toys · Newest first')).toBeTruthy()
  })

  it('draws a long library of toys', async () => {
    mockGet.mockResolvedValue(Array.from({ length: 150 }, (_, i) => toy({ id: `t${i}`, name: `Toy ${i}` })))
    render(<ToyLibraryScreen />)
    expect(await screen.findByText('150 toys · Newest first')).toBeTruthy()
  })
})

describe('nearest first', () => {
  const near = (postcode: unknown) => {
    mockCaps.current = { profile: { id: 'me', pickup_postcode: postcode } }
  }

  it.each(['200', '20000', 'abcd', '', '   ', null])('does not offer Nearest first when the profile postcode is %j', async (pc) => {
    near(pc)
    render(<ToyLibraryScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('radio', { name: 'Newest' })).toBeTruthy()
    expect(screen.queryByText('Nearest first')).toBeNull()
  })

  it('reads a postcode with spaces around it', async () => {
    near(' 2000 ')
    mockGet.mockResolvedValue([toy({ km: 12 })])
    render(<ToyLibraryScreen />)
    await applyFilters(['Nearest first'])
    expect(await screen.findByText('12 km')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys?near=2000')
  })

  it('shows 0 km for a toy next door and none for a toy with no distance', async () => {
    near('2000')
    mockGet.mockResolvedValue([toy({ id: 'a', name: 'Next door', km: 0 }), toy({ id: 'b', name: 'Unknown', km: null })])
    render(<ToyLibraryScreen />)
    await applyFilters(['Nearest first'])
    expect(await screen.findByText('0 km')).toBeTruthy()
    expect(screen.queryByText(/null km|NaN km/)).toBeNull()
  })

  it('shows the answer to the last choice when the first answer arrives after it', async () => {
    near('2000')
    let first!: (v: object[]) => void
    toysInOrder([toy({ name: 'Plain' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Plain')
    toysInOrder(new Promise((r) => (first = r)))
    await applyFilters(['Nearest first'])
    toysInOrder([toy({ name: 'Back to plain' })])
    await applyFilters(['Newest'])
    expect(await screen.findByText('Back to plain')).toBeTruthy()
    await act(async () => first([toy({ name: 'Stale nearest', km: 1 })]))
    expect(screen.queryByText('Stale nearest')).toBeNull()
    expect(screen.getByText('Back to plain')).toBeTruthy()
  })
})

describe('a flaky network', () => {
  it('shows the failure, then the toys after Try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    toysInOrder(Promise.reject(new TypeError('Network request failed')))
    render(<ToyLibraryScreen />)
    expect(await screen.findByText("Couldn't load toys.")).toBeTruthy()
    expect(screen.queryByText(/toys? · /)).toBeNull()
    toysInOrder([toy()])
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it('keeps the toys on screen while a pull to refresh runs, and shows the new list when it lands', async () => {
    toysInOrder([toy({ name: 'First' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('First')
    let resolve!: (v: object[]) => void
    toysInOrder(new Promise((r) => (resolve = r)))
    const list = screen.UNSAFE_getByType(FlatList)
    act(() => list.props.refreshControl.props.onRefresh())
    expect(screen.getByText('First')).toBeTruthy()
    await act(async () => resolve([toy({ name: 'Second' })]))
    await waitFor(() => expect(screen.getByText('Second')).toBeTruthy())
    expect(screen.queryByText('First')).toBeNull()
  })

  it('keeps a typed search and a chosen filter across a refresh', async () => {
    mockGet.mockResolvedValue([toy({ id: 'a', name: 'Bubble' }), toy({ id: 'b', name: 'Drum' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble')
    search('dru')
    await act(async () => screen.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh())
    await waitFor(() => expect(screen.getByText('1 toy · Newest first')).toBeTruthy())
    expect(screen.getByText('Drum')).toBeTruthy()
    expect(screen.queryByText('Bubble')).toBeNull()
  })
})
