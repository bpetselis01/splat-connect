// packages/mobile/tests/unit/components/challenges/my-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MyChallengesScreen } from '../../../../components/challenges/my-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const idea = (over: object) => ({
  id: 'i1',
  author_id: 'viewer1',
  title: 'A switch a toddler can hit',
  summary: 'Too much force needed.',
  description: '',
  intended_use: '',
  primary_user: '',
  contact_prefs: [],
  status: 'pending',
  review_note: null,
  tutorial_id: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  ...over,
})

/** Answers /mine and /joined separately, in whatever order they fire. */
function respond(mine: unknown[] | Error, joined: unknown[] | Error = []) {
  const answer = (v: unknown[] | Error) =>
    v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/ideas/mine') return answer(mine)
    if (path === '/api/ideas/joined') return answer(joined)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  respond([], [])
})

describe('MyChallengesScreen', () => {
  it('labels each idea with its author-facing status word', async () => {
    respond([
      idea({ id: 'i1', title: 'Pending one', status: 'pending' }),
      idea({ id: 'i2', title: 'Published one', status: 'challenge' }),
      idea({ id: 'i3', title: 'Written up', status: 'graduated' }),
      idea({ id: 'i4', title: 'Declined one', status: 'rejected' }),
    ])
    render(<MyChallengesScreen />)

    expect(await screen.findByText('PENDING REVIEW')).toBeTruthy()
    expect(screen.getByText('LOOKING FOR MAKERS')).toBeTruthy()
    expect(screen.getByText('BEING WRITTEN UP')).toBeTruthy()
    expect(screen.getByText('NOT TAKEN FORWARD')).toBeTruthy()
  })

  it("shows a rejected idea's review note, which only its author ever sees", async () => {
    respond([idea({ status: 'rejected', review_note: 'Too close to an existing guide.' })])
    render(<MyChallengesScreen />)
    expect(await screen.findByText('Too close to an existing guide.')).toBeTruthy()
  })

  it('opens a published idea, and refuses to link one with no public page', async () => {
    respond([
      idea({ id: 'live', title: 'Published one', status: 'challenge' }),
      idea({ id: 'quiet', title: 'Pending one', status: 'pending' }),
    ])
    render(<MyChallengesScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Published one' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/live')

    // A pending idea 404s on the public route by design, so its row is not a
    // button at all rather than a dead link.
    expect(screen.queryByRole('button', { name: 'Pending one' })).toBeNull()
    expect(screen.getByText('Pending one')).toBeTruthy()
  })

  it('lists the challenges you joined separately from your own ideas', async () => {
    respond(
      [idea({ id: 'mine1', title: 'My idea' })],
      [idea({ id: 'joined1', title: 'Their challenge', author_id: 'someone', status: 'challenge' })]
    )
    render(<MyChallengesScreen />)

    expect(await screen.findByText('Your ideas')).toBeTruthy()
    expect(screen.getByText('Challenges you joined')).toBeTruthy()
    expect(screen.getByText('My idea')).toBeTruthy()
    expect(screen.getByText('Their challenge')).toBeTruthy()
  })

  it('fails the two lists independently', async () => {
    respond(new Error('down'), [idea({ id: 'j1', title: 'Still here', status: 'challenge' })])
    render(<MyChallengesScreen />)

    expect(await screen.findByText('Could not load your ideas.')).toBeTruthy()
    // One endpoint being flaky must not read as "you have joined nothing".
    expect(screen.getByText('Still here')).toBeTruthy()
    expect(screen.queryByText('Could not load your joined challenges.')).toBeNull()
  })

  it('points an empty ideas list at the form rather than apologising', async () => {
    render(<MyChallengesScreen />)

    expect(await screen.findByText("You haven't submitted an idea yet.")).toBeTruthy()
    // The empty state's button drops the "+", exactly as web's does — which
    // is also what keeps it distinct from the persistent pill above.
    fireEvent.press(screen.getByRole('button', { name: 'Submit an idea' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
  })

  it('points an empty joined list at the board', async () => {
    render(<MyChallengesScreen />)

    expect(await screen.findByText("You haven't joined a challenge yet.")).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Browse design challenges' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges')
  })

  it('refetches on focus so an idea joined elsewhere shows on the way back', async () => {
    render(<MyChallengesScreen />)
    // Mount effect plus the focus effect: two rounds of both endpoints.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/ideas/mine'))
    expect(mockGet.mock.calls.filter((c) => c[0] === '/api/ideas/mine').length).toBeGreaterThan(1)
  })
})
