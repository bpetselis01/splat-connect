// The challenge board: every filter, order, empty and failing states, and the
// "you're in" marker's separate failure.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ChallengesListScreen } from '../../../../components/challenges/list-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
const mockCaps = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps() }))

const signedIn = { caps: { profile: { id: 'viewer1' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }
const signedOut = { caps: null, loading: false, refresh: jest.fn() }
const row = (id: string, over: object = {}) => ({
  id,
  title: `Challenge ${id}`,
  summary: `Summary ${id}`,
  contact_prefs: [],
  status: 'challenge',
  kind: 'challenge',
  answered_at: null,
  maker_count: 0,
  answer_count: 0,
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})
function respond(challenges: unknown[], joined: unknown[] | Error = []) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/public/challenges'
      ? Promise.resolve(challenges)
      : path === '/api/ideas/joined'
        ? joined instanceof Error
          ? Promise.reject(joined)
          : Promise.resolve(joined)
        : Promise.reject(new Error('n/a'))
  )
}
const titles = () => screen.getAllByText(/^Challenge /).map((n) => n.props.children)

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  mockCaps.mockReturnValue(signedIn)
  respond([row('a')])
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('filters', () => {
  const mixed = () => [
    row('build', { maker_count: 0 }),
    row('crew', { maker_count: 2 }),
    row('q', { kind: 'question' }),
    row('done', { status: 'graduated', maker_count: 4 }),
  ]

  it('starts on All and shows every row, open ones first and solved ones last', async () => {
    respond([row('done', { status: 'graduated' }), row('build'), row('q', { kind: 'question' })])
    render(<ChallengesListScreen />)
    await screen.findByText('Challenge build')
    expect(titles()).toEqual(['Challenge build', 'Challenge q', 'Challenge done'])
  })

  it('Build challenges drops questions and graduated rows', async () => {
    respond(mixed())
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Build challenges'))
    expect(titles()).toEqual(['Challenge build', 'Challenge crew'])
  })

  it('Questions keeps only questions', async () => {
    respond(mixed())
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Questions'))
    expect(titles()).toEqual(['Challenge q'])
  })

  it('Has makers keeps rows with at least one maker, graduated ones included', async () => {
    respond(mixed())
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Has makers'))
    expect(titles()).toEqual(['Challenge crew', 'Challenge done'])
  })

  it('Graduated keeps only rows that became guides', async () => {
    respond(mixed())
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Graduated'))
    expect(titles()).toEqual(['Challenge done'])
  })

  it('says nothing is under a filter with no matches, and All brings everything back', async () => {
    respond([row('a')])
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Graduated'))
    expect(screen.getByText('Nothing under graduated yet.')).toBeTruthy()
    expect(screen.queryByText('Challenge a')).toBeNull()
    fireEvent.press(screen.getByText('All'))
    expect(screen.getByText('Challenge a')).toBeTruthy()
  })

  it('keeps the filter when the list is refreshed by coming back to the screen', async () => {
    respond(mixed())
    const { rerender } = render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByText('Questions'))
    rerender(<ChallengesListScreen />)
    expect(titles()).toEqual(['Challenge q'])
  })
})

describe('rows', () => {
  it('shows each row’s counts and pill: makers and posts, or a question’s answers', async () => {
    respond([row('a', { maker_count: 3, answer_count: 4 }), row('q', { kind: 'question', answer_count: 1 }), row('qa', { kind: 'question', answered_at: '2026-08-03' })])
    render(<ChallengesListScreen />)
    expect(await screen.findByText('3 makers · 4 posts')).toBeTruthy()
    expect(screen.getByText('1 answer')).toBeTruthy()
    expect(screen.getByText('Answered')).toBeTruthy()
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
  })

  it('opens a row by id', async () => {
    respond([row('abc')])
    render(<ChallengesListScreen />)
    fireEvent.press(await screen.findByLabelText('Challenge abc'))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/abc')
  })

  it.each(NAMES)('shows a title and summary with $label as typed', async ({ value }) => {
    respond([row('a', { title: value, summary: value })])
    render(<ChallengesListScreen />)
    expect((await screen.findAllByText(value)).length).toBeGreaterThan(0)
  })

  it('draws a one-item list as one row with the filters', async () => {
    render(<ChallengesListScreen />)
    await screen.findByText('Challenge a')
    expect(titles()).toHaveLength(1)
    expect(screen.getByText('All')).toBeTruthy()
  })

  it('draws a long list in full', async () => {
    respond(Array.from({ length: 60 }, (_, i) => row(`n${i}`)))
    render(<ChallengesListScreen />)
    await screen.findByText('Challenge n0')
    expect(titles()).toHaveLength(60)
  })

  it('shows a row for a challenge the viewer joined with the marker, and not on one they did not', async () => {
    respond([row('a'), row('b')], [{ id: 'a' }])
    render(<ChallengesListScreen />)
    await screen.findByText('Challenge b')
    expect(screen.getAllByText("You're in", { includeHiddenElements: true })).toHaveLength(1)
  })
})

describe('failing and empty', () => {
  it('shows the rows without the marker when only the joined list fails', async () => {
    respond([row('a')], new Error('Network request failed'))
    render(<ChallengesListScreen />)
    expect(await screen.findByText('Challenge a')).toBeTruthy()
    expect(screen.queryByText("You're in", { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByText("Couldn't load design challenges.")).toBeNull()
  })

  it('says the challenges could not load, with no rows, when the board read fails', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<ChallengesListScreen />)
    expect(await screen.findByText("Couldn't load design challenges.")).toBeTruthy()
    expect(screen.queryByText('All')).toBeNull()
  })

  it('says it could not load, then shows the rows when Try again works', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<ChallengesListScreen />)
    await screen.findByText("Couldn't load design challenges.")
    respond([row('a')])
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Challenge a')).toBeTruthy()
    expect(screen.queryByText("Couldn't load design challenges.")).toBeNull()
  })

  it('shows the empty state, not the filters, for a board with no challenges', async () => {
    respond([])
    render(<ChallengesListScreen />)
    expect(await screen.findByText('No challenges are open yet.')).toBeTruthy()
    expect(screen.queryByText('Build challenges')).toBeNull()
    fireEvent.press(screen.getByText('+ Submit an idea'))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
  })

  it('shows a skeleton and neither state while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<ChallengesListScreen />)
    expect(screen.queryByText('No challenges are open yet.')).toBeNull()
    expect(screen.queryByText("Couldn't load design challenges.")).toBeNull()
  })
})

describe('signed in or out', () => {
  it('reads the board without asking for the joined list when signed out', async () => {
    mockCaps.mockReturnValue(signedOut)
    render(<ChallengesListScreen />)
    await screen.findByText('Challenge a')
    expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/joined')
  })

  it('asks again with the joined list once the viewer signs in', async () => {
    mockCaps.mockReturnValue(signedOut)
    respond([row('a')], [{ id: 'a' }])
    const { rerender } = render(<ChallengesListScreen />)
    await screen.findByText('Challenge a')
    expect(screen.queryByText("You're in", { includeHiddenElements: true })).toBeNull()
    mockCaps.mockReturnValue(signedIn)
    rerender(<ChallengesListScreen />)
    expect(await screen.findByText("You're in", { includeHiddenElements: true })).toBeTruthy()
  })
})
