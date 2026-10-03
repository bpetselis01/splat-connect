// My challenges: both lists failing, the stage filter's empty results, one
// idea that is both yours and joined, and titles with odd characters.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyChallengesScreen } from '../../../../components/challenges/my-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const idea = (id: string, over: object = {}) => ({
  id,
  author_id: 'viewer1',
  title: `Idea ${id}`,
  summary: 'S',
  description: '',
  contact_prefs: [],
  status: 'challenge',
  review_note: null,
  tutorial_id: null,
  created_at: '2026-08-01T12:00:00',
  updated_at: '2026-08-01T12:00:00',
  maker_count: 0,
  answer_count: 0,
  ...over,
})
function respond(mine: unknown[] | Error, joined: unknown[] | Error = []) {
  const answer = (v: unknown[] | Error) => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v))
  mockGet.mockImplementation((path: string) =>
    path === '/api/ideas/mine' ? answer(mine) : path === '/api/ideas/joined' ? answer(joined) : Promise.reject(new Error('n/a'))
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  respond([], [])
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('says each list failed, never "you have nothing", when both reads fail, and shows no stage filter', async () => {
  respond(new Error('down'), new Error('down'))
  render(<MyChallengesScreen />)
  expect(await screen.findByText('Could not load your ideas.')).toBeTruthy()
  expect(screen.getByText('Could not load your joined challenges.')).toBeTruthy()
  expect(screen.queryByText("You haven't submitted an idea yet.")).toBeNull()
  expect(screen.queryByLabelText(/^All, /)).toBeNull()
})

it('shows both lists as skeletons, with no empty state, while loading', () => {
  mockGet.mockReturnValue(new Promise(() => {}))
  render(<MyChallengesScreen />)
  expect(screen.queryByText("You haven't submitted an idea yet.")).toBeNull()
  expect(screen.queryByText("You haven't joined a challenge yet.")).toBeNull()
})

it('shows the persistent Submit an idea pill even once ideas exist', async () => {
  respond([idea('a')])
  render(<MyChallengesScreen />)
  await screen.findByText('Idea a')
  fireEvent.press(screen.getByText('+ Submit an idea'))
  expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
})

it('counts an idea that is both yours and joined once on the filter, and lists it under both headings', async () => {
  respond([idea('both')], [idea('both')])
  render(<MyChallengesScreen />)
  expect(await screen.findByLabelText('All, 1')).toBeTruthy()
  expect(screen.getAllByText('Idea both')).toHaveLength(2)
})

it('says nothing is at that stage when a stage has no ideas in either list, and Show everything resets it', async () => {
  respond([idea('a', { status: 'challenge' })])
  render(<MyChallengesScreen />)
  fireEvent.press(await screen.findByLabelText('Declined, 0'))
  expect(screen.getByText('Nothing at that stage.')).toBeTruthy()
  expect(screen.queryByText('Idea a')).toBeNull()
  expect(screen.queryByText('Your ideas')).toBeNull()
  fireEvent.press(screen.getByText('Show everything'))
  expect(screen.getByText('Idea a')).toBeTruthy()
})

it('narrows to a stage that only the joined list has, leaving the empty ideas heading out', async () => {
  respond([], [idea('j', { author_id: 'other', status: 'graduated' })])
  render(<MyChallengesScreen />)
  fireEvent.press(await screen.findByLabelText('Waiting, 1'))
  expect(screen.getByText('Idea j')).toBeTruthy()
  expect(screen.queryByText('Your ideas')).toBeNull()
  expect(screen.queryByText("You haven't submitted an idea yet.")).toBeNull()
})

it('keeps a failed list on screen under a stage filter, so a stage cannot hide the failure', async () => {
  respond(new Error('down'), [idea('j', { author_id: 'other', status: 'challenge' })])
  render(<MyChallengesScreen />)
  fireEvent.press(await screen.findByLabelText('Live, 1'))
  expect(screen.getByText('Could not load your ideas.')).toBeTruthy()
})

it('opens a joined challenge by its id', async () => {
  respond([], [idea('j', { author_id: 'other' })])
  render(<MyChallengesScreen />)
  fireEvent.press(await screen.findByRole('button', { name: 'Idea j' }))
  expect(mockPush).toHaveBeenCalledWith('/explore/challenges/j')
})

it.each(NAMES)('shows an idea titled with $label as typed', async ({ value }) => {
  respond([idea('a', { title: value })])
  render(<MyChallengesScreen />)
  expect((await screen.findAllByText(value)).length).toBeGreaterThan(0)
})

it('lists a long set of ideas in full', async () => {
  respond(Array.from({ length: 40 }, (_, i) => idea(`n${i}`)))
  render(<MyChallengesScreen />)
  await screen.findByText('Idea n0')
  expect(screen.getAllByText(/^Idea n/)).toHaveLength(40)
})
