// packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { theme } from '../../../../lib/theme'
import { ScrollView, FlatList, StyleSheet } from 'react-native'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as the
// rest of the suite.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

// useSaves is mocked directly (rather than driven through apiClient) so a
// save press can be asserted against exactly what SaveButton is contracted
// to call — toggle('toys', id) — without also exercising the network layer.
const mockToggle = jest.fn()
const NO_SAVES = { tutorials: [], toys: [], challenges: [] }
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: NO_SAVES, isSaved: () => false, toggle: mockToggle }),
}))

// The CornerMenu shows an exchange-action count from capabilities; the screen
// must render without them (signed out, or the fetch failing).
const mockCaps = { current: null as null | { profile: Record<string, unknown> } }
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockCaps.current, loading: false, refresh: jest.fn() }),
}))

const toy = (over: object) => ({
  id: 'toy1',
  owner_id: 'u1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: null,
  condition: 8,
  switch_adapted: false,
  photo_urls: [],
  cover_photo_url: null,
  switch_photo_url: null,
  status: 'published',
  offer_type: 'donation',
  created_at: '',
  updated_at: '',
  profiles: { name: 'Jamie' },
  organizations: null,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
  mockGet.mockResolvedValue([])
})

describe('ToyLibraryScreen', () => {
  it('asks for a postcode before it can sort nearest first', async () => {
    render(<ToyLibraryScreen />)
    fireEvent.press(await screen.findByText('Add your postcode'))
    expect(mockPush).toHaveBeenCalledWith('/account')
  })

  it('sorts nearest first from the profile postcode, with km on each toy', async () => {
    mockCaps.current = { profile: { id: 'me', pickup_postcode: '2000' } }
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/public/toys?near=2000' ? [toy({ id: 't1', name: 'Bubble machine', km: 3 })] : [])
    )
    render(<ToyLibraryScreen />)
    fireEvent.press(await screen.findByText('Nearest first'))
    expect(await screen.findByText('3 km')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys?near=2000')
  })

  it('renders toy names from the public toys endpoint', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('Switch car')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys')
  })

  it('filters the list by search text', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'switch')
    expect(screen.queryByText('Bubble machine')).toBeNull()
    expect(screen.getByText('Switch car')).toBeTruthy()
  })

  it('shows the condition grade and the holder for a person-held toy and an org-held toy', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine', condition: 8, profiles: { name: 'Jamie' }, organizations: null }),
      toy({
        id: 't2',
        name: 'Switch car',
        condition: 5,
        owner_id: null,
        owner_org_id: 'org1',
        quantity: 4,
        profiles: null,
        organizations: { name: 'TAD Australia' },
      }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    // Words, never a score: 8 is "Good", 5 is "Well-loved".
    expect(screen.getAllByText('Good', { includeHiddenElements: true })).toHaveLength(2)
    expect(screen.getAllByText('Well-loved', { includeHiddenElements: true })).toHaveLength(2)
    expect(screen.getByText('Jamie')).toBeTruthy()
    expect(screen.getByText('TAD Australia')).toBeTruthy()
    // The number survives for a screen reader, in the row's hint.
    expect(screen.getByLabelText('Bubble machine').props.accessibilityHint).toContain('condition 8 of 10')
  })

  it('shows the quantity badge only on the org-owned row', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine' }),
      toy({
        id: 't2',
        name: 'Switch car',
        owner_id: null,
        owner_org_id: 'org1',
        quantity: 4,
        organizations: { name: 'TAD Australia' },
      }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getAllByText('4 available', { includeHiddenElements: true }).length).toBe(1)
    // A person's toy is one unit, so it just says Available.
    expect(screen.getAllByText('Available', { includeHiddenElements: true }).length).toBeGreaterThan(1)
  })

  it('shows the switch-adapted badge only when the toy is adapted', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine', switch_adapted: false }),
      toy({ id: 't2', name: 'Switch car', switch_adapted: true }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    // One pill, plus the filter chip of the same name.
    expect(screen.getAllByText('Switch-adapted', { includeHiddenElements: true }).length).toBe(2)
  })

  it('filters by the four condition grades', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Good toy', condition: 8 }),
      toy({ id: 't2', name: 'Worn toy', condition: 2 }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Good toy')
    fireEvent.press(screen.getByRole('button', { name: 'Needs a fix' }))
    expect(screen.queryByText('Good toy')).toBeNull()
    expect(screen.getByText('Worn toy')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Good' }))
    expect(screen.getByText('Good toy')).toBeTruthy()
    expect(screen.queryByText('Worn toy')).toBeNull()
  })

  it('filters by the switch-adapted toggle', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Plain toy', switch_adapted: false }),
      toy({ id: 't2', name: 'Adapted toy', switch_adapted: true }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Plain toy')
    fireEvent.press(screen.getByRole('button', { name: 'Switch-adapted' }))
    expect(screen.queryByText('Plain toy')).toBeNull()
    expect(screen.getByText('Adapted toy')).toBeTruthy()
  })

  it('flips a save by calling toggle with the toys slug and the toy id', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getAllByLabelText('Save')[0])
    expect(mockToggle).toHaveBeenCalledWith('toys', 't1')
  })

  it('navigates to the toy detail route on card press', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    const card = await screen.findByLabelText('Bubble machine')
    fireEvent.press(card)
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  })

  it('navigates to give-a-toy and organisations from their respective rows', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByLabelText('Toy actions'))
    fireEvent.press(screen.getByLabelText('Give a toy'))
    expect(mockPush).toHaveBeenCalledWith('/toys/new')
    fireEvent.press(screen.getByRole('tab', { name: 'Organisations' }))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisations')
  })

  it('filters to available toys and orders by newest', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Older toy', created_at: '2026-01-01T00:00:00Z' }),
      toy({ id: 't2', name: 'Newer toy', created_at: '2026-06-01T00:00:00Z' }),
      toy({ id: 't3', name: 'Gone toy', owner_id: null, owner_org_id: 'o1', quantity: 0, organizations: { name: 'TAD' } }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Older toy')
    fireEvent.press(screen.getByRole('button', { name: 'Available' }))
    expect(screen.queryByText('Gone toy')).toBeNull()
    expect(screen.getByText('Matching toys')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Newest' }))
    expect(screen.getAllByText(/^(Older|Newer) toy$/).map((t) => t.props.children)).toEqual(['Newer toy', 'Older toy'])
  })

  it('shows an error message when apiClient.get rejects, and retries', async () => {
    mockGet.mockRejectedValueOnce(new Error('API GET failed with status 500'))
    render(<ToyLibraryScreen />)
    expect(await screen.findByText("Couldn't load toys.")).toBeTruthy()
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it('shows the count line', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    await waitFor(() => expect(screen.getByText('2 toys')).toBeTruthy())
  })

  it('clears every filter from the empty state in one tap', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'zzz')
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/not-built' }))
  })
})

const clears = (nodes: { props: { contentContainerStyle?: unknown } }[]) =>
  nodes.some((n) => (StyleSheet.flatten(n.props.contentContainerStyle as object) as { paddingBottom?: number } | undefined)?.paddingBottom === tabBarClearance(0))

it('pads its list so the last row clears the floating tab bar', () => {
  render(<ToyLibraryScreen />)
  expect(clears(screen.UNSAFE_getAllByType(FlatList))).toBe(true)
})

// The page ground is the background token, and the scroll frame spans the
// Screen padding so it cannot clip the cards' shadows into a grey rectangle.
const groundOk = (root: any, frame: { props: { style?: unknown; contentContainerStyle?: unknown } }) => {
  const ground = StyleSheet.flatten(root.props.style) as { backgroundColor?: string }
  const f = StyleSheet.flatten(frame.props.style as object) as { marginHorizontal?: number }
  const c = StyleSheet.flatten(frame.props.contentContainerStyle as object) as { paddingHorizontal?: number }
  return ground.backgroundColor === theme.colors.background && f.marginHorizontal === -16 && c.paddingHorizontal === 16
}

it('sits on the page ground with a full-width scroll frame', () => {
  render(<ToyLibraryScreen />)
  expect(groundOk(screen.toJSON(), screen.UNSAFE_getByType(FlatList))).toBe(true)
})
