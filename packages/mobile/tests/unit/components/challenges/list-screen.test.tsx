// packages/mobile/tests/unit/components/challenges/list-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ChallengesListScreen } from '../../../../components/challenges/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — a mount-time useEffect stands in, same as
// exchanges/list-screen.test.tsx.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const signedIn = {
  caps: {
    profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
}
const signedOut = { caps: null, loading: false, refresh: jest.fn() }

const row = (over: object) => ({
  id: 'c1',
  title: 'A switch a toddler can hit',
  summary: 'Every switch we have needs more force than she can manage.',
  contact_prefs: [],
  status: 'challenge',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})

/** Routes the two GETs this screen makes by path, in whatever order they fire. */
function respond(challenges: unknown[], joined: unknown[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/public/challenges') return Promise.resolve(challenges)
    if (path === '/api/ideas/joined') return Promise.resolve(joined)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(signedIn)
  respond([])
})

describe('ChallengesListScreen', () => {
  it('splits open challenges from the ones that became guides', async () => {
    respond([
      row({ id: 'c1', title: 'A switch a toddler can hit', status: 'challenge' }),
      row({ id: 'c2', title: 'A one-handed board game', status: 'graduated' }),
    ])
    render(<ChallengesListScreen />)

    expect(await screen.findByText('A switch a toddler can hit')).toBeTruthy()
    expect(screen.getByText('A one-handed board game')).toBeTruthy()
    expect(screen.getByText('Open challenges')).toBeTruthy()
    expect(screen.getByText('Solved · became guides')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/challenges')
  })

  it("marks the challenges you have joined with a you're in badge", async () => {
    respond(
      [row({ id: 'c1', title: 'Joined one' }), row({ id: 'c2', title: 'Not joined one' })],
      [{ id: 'c1' }]
    )
    render(<ChallengesListScreen />)

    await screen.findByText('Joined one')
    // Hidden from the a11y tree on purpose (the row's hint carries it), so
    // the query has to opt in — same as learn-hub.test.tsx's node ticks.
    await waitFor(() =>
      expect(screen.getAllByText("YOU'RE IN", { includeHiddenElements: true })).toHaveLength(1)
    )
    expect(
      screen.getByRole('button', { name: 'Joined one' }).props.accessibilityHint
    ).toContain("You're in")
  })

  it('never asks for the joined list when signed out', async () => {
    mockUseCapabilities.mockReturnValue(signedOut)
    respond([row({})])
    render(<ChallengesListScreen />)

    await screen.findByText('A switch a toddler can hit')
    expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/joined')
    expect(screen.queryByText("YOU'RE IN", { includeHiddenElements: true })).toBeNull()
  })

  it('opens the challenge it is told to', async () => {
    respond([row({ id: 'c9', title: 'Tap me' })])
    render(<ChallengesListScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Tap me' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/c9')
  })

  it('sends the pill to Submit an idea', async () => {
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByRole('button', { name: '+ Submit an idea' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
  })

  it('offers a retry when the challenges fetch fails, and recovers on it', async () => {
    // Rejects every call, not just the first: the focus effect refetches on
    // mount, and a one-shot rejection would be papered over by that retry.
    mockGet.mockRejectedValue(new Error('down'))
    render(<ChallengesListScreen />)

    expect(await screen.findByText("Couldn't load design challenges.")).toBeTruthy()

    respond([row({ title: 'Back online' })])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back online')).toBeTruthy()
  })

  it('teaches what a challenge is when none are open', async () => {
    render(<ChallengesListScreen />)
    expect(await screen.findByText('No challenges are open yet.')).toBeTruthy()
  })
})
