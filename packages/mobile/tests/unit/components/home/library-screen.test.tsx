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

const row = (over: object) => ({
  id: 't1', title: 'Bubble machine', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
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
}: { tutorials?: Promise<unknown>; saves?: Promise<unknown> } = {}) {
  mockGet.mockImplementation((p: string) => (p === '/api/saves/ids' ? saves : tutorials))
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
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.press(screen.getByRole('button', { name: 'Hard' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials?difficulty=hard'))
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

  it('shows the backing line, the kind badge and a save bookmark per card', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: 't1', tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'TAD Australia' } }] }),
        row({ id: 't2', title: 'Head switch arm', kind: 'assistive_tech' }),
      ]),
    })
    render(<LibraryScreen />)
    await waitFor(() => expect(screen.getByText('Backed by TAD Australia')).toBeTruthy())
    expect(screen.getByText('Reviewed by SPLAT')).toBeTruthy()
    // The kind badge is hidden from the accessibility tree (same reason as the
    // difficulty badge: its spoken name would collide with the kind filter
    // chip's), so it must be queried with includeHiddenElements.
    expect(screen.getAllByText('TOY ADAPTATION', { includeHiddenElements: true }).length).toBe(1)
    expect(screen.getAllByLabelText('Save').length).toBe(2)
    // The row's hint carries the kind for screen readers instead.
    expect(screen.getByLabelText('Bubble machine').props.accessibilityHint).toContain('Toy adaptation')
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
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.press(screen.getByLabelText('Assistive tech'))
    expect(screen.queryByText('Bubble machine')).toBeNull()
    expect(screen.getByText('Head switch arm')).toBeTruthy()
  })
})
