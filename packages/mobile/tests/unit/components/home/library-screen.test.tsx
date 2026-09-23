// packages/mobile/tests/unit/components/home/library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
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
  jest.clearAllMocks()
  mockEndpoints({
    tutorials: Promise.resolve([
      row({ id: '1', title: 'Build a Robot Arm', difficulty: 'easy' }),
      row({ id: '2', title: 'Advanced Gearbox', difficulty: 'hard' }),
    ]),
  })
})

describe('LibraryScreen', () => {
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
    fireEvent.press(screen.getByRole('button', { name: 'Hard' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials?difficulty=hard'))
  })

  it('clears a difficulty by pressing its chip again', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getByRole('button', { name: 'Easy' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials?difficulty=easy'))
    mockGet.mockClear()
    fireEvent.press(screen.getByRole('button', { name: 'Easy' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials'))
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
    expect(screen.queryByText(/Suits/)).toBeNull()
  })
})
