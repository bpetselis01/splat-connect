// packages/mobile/tests/unit/components/home/library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { theme } from '../../../../lib/theme'
import { ScrollView, FlatList, StyleSheet } from 'react-native'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'
import { LibraryScreen } from '../../../../components/home/library-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as Task 1's
// SaveButton test.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
let mockParams: Record<string, string> = {}
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => mockParams }))
// The greeting reads the first name off capabilities.
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { name: 'Priya Nadarajah' } }, loading: false, refresh: jest.fn() }),
}))

const row = (over: object) => ({
  id: 't1', title: 'Bubble machine', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, tutorial_orgs: [], ...over,
})

const NO_SAVES = { tutorials: [], toys: [], challenges: [] }

// LibraryScreen fires two independent apiClient.get calls on mount — useSaves'
// ids fetch and the tutorial list fetch — in whatever order React runs their
// effects. Routing by path (rather than mockResolvedValueOnce chaining) means
// a test can aim a rejection or a payload at one endpoint without caring which
// fires first.
function mockEndpoints({
  tutorials = Promise.resolve([]),
  saves = Promise.resolve(NO_SAVES),
  children = Promise.resolve([]),
}: { tutorials?: Promise<unknown>; saves?: Promise<unknown>; children?: Promise<unknown> } = {}) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/saves/ids' ? saves : p === '/api/child-profiles' ? children : tutorials
  )
}

beforeEach(() => {
  mockParams = {}
  jest.clearAllMocks()
  mockEndpoints({
    tutorials: Promise.resolve([
      row({ id: '1', title: 'Build a Robot Arm', difficulty: 'easy' }),
      row({ id: '2', title: 'Advanced Gearbox', difficulty: 'hard' }),
    ]),
  })
})


const clears = (nodes: { props: { contentContainerStyle?: unknown } }[]) =>
  nodes.some((n) => (StyleSheet.flatten(n.props.contentContainerStyle as object) as { paddingBottom?: number } | undefined)?.paddingBottom === tabBarClearance(0))


// The page ground is the background token, and the scroll frame spans the
// Screen padding so it cannot clip the cards' shadows into a grey rectangle.
const groundOk = (root: any, frame: { props: { style?: unknown; contentContainerStyle?: unknown } }) => {
  const ground = StyleSheet.flatten(root.props.style) as { backgroundColor?: string }
  const f = StyleSheet.flatten(frame.props.style as object) as { marginHorizontal?: number }
  const c = StyleSheet.flatten(frame.props.contentContainerStyle as object) as { paddingHorizontal?: number }
  return ground.backgroundColor === theme.colors.background && f.marginHorizontal === -16 && c.paddingHorizontal === 16
}

describe('LibraryScreen', () => {
  it('sits on the page ground with a full-width scroll frame', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    expect(groundOk(screen.toJSON(), screen.UNSAFE_getByType(FlatList))).toBe(true)
  })

  it('pads its list so the last row clears the floating tab bar', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    expect(clears(screen.UNSAFE_getAllByType(FlatList))).toBe(true)
  })

  it('carries an organisation to print with into the guide it opens', async () => {
    mockParams = { printWith: 'o1' }
    render(<LibraryScreen />)
    fireEvent.press(await screen.findByText('Build a Robot Arm'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]', params: { id: '1', printWith: 'o1' } })
  })

  it('renders tutorial titles from the public tutorials endpoint', async () => {
    render(<LibraryScreen />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials')
  })

  it('filters the list by search text', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'gearbox')
    expect(screen.queryByText('Build a Robot Arm')).toBeNull()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
  })

  it('matches search against the description, not only the title', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Build a Robot Arm', description: 'A switch-adapted spinning top' }),
        row({ id: '2', title: 'Advanced Gearbox', difficulty: 'hard' }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'spinning')
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.queryByText('Advanced Gearbox')).toBeNull()
  })

  it('refetches with a difficulty filter when a chip is pressed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.press(screen.getByRole('button', { name: 'Hard' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials?difficulty=hard'))
  })

  it('clears a difficulty by pressing its chip again', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.press(screen.getByRole('button', { name: 'Easy' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials?difficulty=easy'))
    mockGet.mockClear()
    fireEvent.press(screen.getByRole('button', { name: 'Easy' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials'))
  })

  it('keeps the filter chips behind one Filters button, search stays out', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    expect(screen.queryByRole('button', { name: 'Under 30 min' })).toBeNull()
    expect(screen.getByPlaceholderText('Search by toy name')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('button', { name: 'Under 30 min' })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Under 30 min' }))
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeTruthy()
  })

  it('greets by first name over the Guide library title', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    expect(screen.getByText(/^Good (morning|afternoon|evening), Priya$/)).toBeTruthy()
    expect(screen.getByText('Guide library')).toBeTruthy()
  })

  it('filters to quick builds and to printable guides', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Quick one', build_minutes: 20, has_stl: false }),
        row({ id: '2', title: 'Slow printed one', build_minutes: 90, has_stl: true }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Quick one')
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.press(screen.getByRole('button', { name: 'Under 30 min' }))
    expect(screen.queryByText('Slow printed one')).toBeNull()
    expect(screen.getByText('Matching guides')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Under 30 min' }))
    fireEvent.press(screen.getByRole('button', { name: 'Printable' }))
    expect(screen.queryByText('Quick one')).toBeNull()
    expect(screen.getByText('Slow printed one')).toBeTruthy()
  })

  it('sorts by build time and flips the direction', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Long build', build_minutes: 120 }),
        row({ id: '2', title: 'Short build', build_minutes: 10 }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Long build')
    const order = () => screen.getAllByText(/ build$/).map((t) => t.props.children)
    fireEvent.press(screen.getByRole('button', { name: 'Sort: Date added' }))
    fireEvent.press(screen.getByRole('button', { name: 'Build time' }))
    expect(order()).toEqual(['Short build', 'Long build'])
    fireEvent.press(screen.getByRole('button', { name: 'Switch to longest first' }))
    expect(order()).toEqual(['Long build', 'Short build'])
  })

  it('shows an error message when apiClient.get rejects', async () => {
    mockGet.mockRejectedValue(new Error('API GET failed with status 500'))
    render(<LibraryScreen />)
    expect(await screen.findByText("Couldn't load tutorials.")).toBeTruthy()
  })

  it('retries the fetch when the error state button is pressed', async () => {
    mockEndpoints({ tutorials: Promise.reject(new Error('API GET failed with status 500')) })
    render(<LibraryScreen />)
    await screen.findByText("Couldn't load tutorials.")
    // Second attempt succeeds — pressing "Try again" must re-run the fetch and
    // clear the error, which pull-to-retry copy alone could never do here.
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Build a Robot Arm' }),
        row({ id: '2', title: 'Advanced Gearbox', difficulty: 'hard' }),
      ]),
    })
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
  })

  it('shows a Backed pill only on a backed guide, and a save heart per card', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: 't1', tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'TAD Australia' } }] }),
        row({ id: 't2', title: 'Head switch arm', kind: 'assistive_tech' }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Head switch arm')
    // Pills are hidden from the accessibility tree — a "Hard" pill would make
    // the card answer to the Hard chip's name — so query with hidden elements.
    expect(screen.getAllByText('Backed', { includeHiddenElements: true }).length).toBe(1)
    expect(screen.getAllByLabelText('Save').length).toBe(2)
    // The row's hint carries the kind and the backer for screen readers.
    const hint = screen.getByLabelText('Bubble machine').props.accessibilityHint
    expect(hint).toContain('Toy adaptation')
    expect(hint).toContain('Backed by TAD Australia')
    expect(screen.getByLabelText('Head switch arm').props.accessibilityHint).toContain('Reviewed by SPLAT')
  })

  it('filters by kind client-side', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: 't1' }),
        row({ id: 't2', title: 'Head switch arm', kind: 'assistive_tech' }),
      ]),
    })
    render(<LibraryScreen />)
    await waitFor(() => expect(screen.getByText('Bubble machine')).toBeTruthy())
    fireEvent.press(screen.getByRole('tab', { name: 'Assistive tech' }))
    expect(screen.queryByText('Bubble machine')).toBeNull()
    expect(screen.getByText('Head switch arm')).toBeTruthy()
  })

  it('captions the skeletons while guides load', async () => {
    mockEndpoints({ tutorials: new Promise(() => {}) })
    render(<LibraryScreen />)
    expect(await screen.findByText('Loading guides…')).toBeTruthy()
  })

  it('clears every filter from the empty state in one tap', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'zzz')
    expect(screen.queryByText('Build a Robot Arm')).toBeNull()
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
  })

  it('matches a guide by the parts it uses', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Bubble machine', parts: [{ name: 'Jelly Bean switch' }] }),
        row({ id: '2', title: 'Robot arm', parts: [{ name: 'Servo' }] }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'jelly')
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(screen.queryByText('Robot arm')).toBeNull()
  })
})

// 080: the board's "Suits Ollie" — a chip that narrows the list to the guides
// that suit one of the parent's children, drawn only when some do.
describe('Suits <child>', () => {
  const tagged = row({ id: 't9', title: 'Light touch switch', switch_force: 'very_light', switch_hold: 'moment' })
  const firm = row({ id: 't8', title: 'Firm lever', switch_force: 'full' })

  it('filters to the guides that suit the child', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([tagged, firm]),
      children: Promise.resolve([{ name: 'Ollie', press_force: 'light', hold: 'second', aim: null }]),
    })
    render(<LibraryScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Filters' }))
    fireEvent.press(await screen.findByLabelText('Suits Ollie · 1'))
    await waitFor(() => expect(screen.queryByText('Firm lever')).toBeNull())
    expect(screen.getByText('Light touch switch')).toBeTruthy()
    // The section heading names who the list is for.
    expect(screen.getByText('Suits Ollie')).toBeTruthy()
  })

  it('says nothing without a child', async () => {
    mockEndpoints({ tutorials: Promise.resolve([tagged]) })
    render(<LibraryScreen />)
    await screen.findByText('Light touch switch')
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.queryByText(/Suits/)).toBeNull()
  })

  // wizard-mascot-done: the done screen's "See the matches" lands here with suits=1.
  it('arrives already filtered, and says so on the Filters button, when opened with suits=1', async () => {
    mockParams = { suits: '1' }
    mockEndpoints({
      tutorials: Promise.resolve([tagged, firm]),
      children: Promise.resolve([{ name: 'Ollie', press_force: 'light', hold: 'second', aim: null }]),
    })
    render(<LibraryScreen />)
    expect(await screen.findByText('Light touch switch')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Firm lever')).toBeNull())
    expect(screen.getByText('Suits Ollie')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeTruthy()
  })
})
