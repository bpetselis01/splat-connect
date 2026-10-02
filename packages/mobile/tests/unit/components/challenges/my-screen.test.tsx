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

    expect(await screen.findByText('Pending review')).toBeTruthy()
    expect(screen.getByText('Looking for makers')).toBeTruthy()
    expect(screen.getByText('Being written up')).toBeTruthy()
    expect(screen.getByText('Not taken forward')).toBeTruthy()
  })

  it('counts each stage on the filter, once per idea, and narrows both lists to it', async () => {
    respond(
      [
        idea({ id: 'i1', title: 'Pending one', status: 'pending' }),
        idea({ id: 'i2', title: 'Published one', status: 'challenge' }),
        idea({ id: 'i4', title: 'Declined one', status: 'rejected' }),
      ],
      // Graduated reads as Waiting; i2 is both yours and joined and counts once.
      [idea({ id: 'i3', title: 'Written up', status: 'graduated' }), idea({ id: 'i2', title: 'Published one', status: 'challenge' })]
    )
    render(<MyChallengesScreen />)

    expect(await screen.findByLabelText('All, 4')).toBeTruthy()
    expect(screen.getByLabelText('Live, 1')).toBeTruthy()
    expect(screen.getByLabelText('Waiting, 2')).toBeTruthy()
    expect(screen.getByLabelText('Declined, 1')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Waiting, 2'))
    expect(screen.getByText('Pending one')).toBeTruthy()
    expect(screen.getByText('Written up')).toBeTruthy()
    expect(screen.queryByText('Declined one')).toBeNull()
    expect(screen.queryByText('Published one')).toBeNull()
  })

  it('reads each row the way the board does', async () => {
    respond(
      [
        idea({ id: 'm1', title: 'Bubbles', status: 'challenge', created_at: '2026-09-02T00:00:00Z', maker_count: 3, answer_count: 0 }),
        idea({ id: 'm2', title: 'Light box', status: 'pending', created_at: '2026-08-28T00:00:00Z' }),
        idea({ id: 'm3', title: 'Spoon', status: 'rejected', review_note: 'Too close to an existing guide.', updated_at: '2026-04-11T00:00:00Z' }),
      ],
      [
        idea({ id: 'j1', title: 'Tray mount', author_id: 'other', status: 'challenge', joined_at: '2026-07-12T00:00:00Z', maker_count: 5, answer_count: 9 }),
        idea({ id: 'j2', title: 'Quiet fan', author_id: 'other', status: 'graduated', joined_at: '2026-05-03T00:00:00Z' }),
      ]
    )
    render(<MyChallengesScreen />)
    expect(await screen.findByText('Your idea · submitted 2 Sep · 3 makers joined')).toBeTruthy()
    expect(screen.getByText('Your idea · submitted 28 Aug · with an admin')).toBeTruthy()
    expect(screen.getByText('Your idea · declined 11 Apr — a reason is attached')).toBeTruthy()
    expect(screen.getByText('Joined 12 Jul · 5 makers · 9 posts')).toBeTruthy()
    expect(screen.getByText('Joined 3 May · being written up')).toBeTruthy()
    // The reason itself is read on the idea, never on the list.
    expect(screen.queryByText('Too close to an existing guide.')).toBeNull()
  })

  it('opens every idea of your own, published or not', async () => {
    respond([
      idea({ id: 'live', title: 'Published one', status: 'challenge' }),
      idea({ id: 'quiet', title: 'Pending one', status: 'pending' }),
    ])
    render(<MyChallengesScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Published one' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/live')
    fireEvent.press(screen.getByRole('button', { name: 'Pending one' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/quiet')
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
