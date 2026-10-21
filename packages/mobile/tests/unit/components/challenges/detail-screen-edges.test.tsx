// A challenge's detail across who is looking (signed out, stranger, maker,
// author) and what state it is in (open, answered, written up, pending,
// rejected), plus every write's failure path.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ChallengeDetailScreen } from '../../../../components/challenges/detail-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockPush = jest.fn()
const mockRecord = jest.fn()
jest.mock('../../../../lib/recents', () => ({ recordRecent: (...a: unknown[]) => mockRecord(...a) }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
const mockToggle = jest.fn()
let mockSaved = false
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => mockSaved, toggle: mockToggle }),
}))
const mockCaps = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps() }))
const mockConfirm = jest.fn()
jest.mock('../../../../lib/confirm', () => ({
  confirmDestructive: (...a: unknown[]) => mockConfirm(...a),
}))

const viewer = (id: string) => ({ caps: { profile: { id, name: 'Viewer' }, ledOrgs: [] }, loading: false, refresh: jest.fn() })
const signedOut = { caps: null, loading: false, refresh: jest.fn() }
const notFound = () => Object.assign(new Error('404'), { status: 404 })

const detail = (over: object = {}) => ({
  id: 'c1',
  author_id: 'author1',
  author_name: 'Priya',
  title: 'A switch a toddler can hit',
  summary: 'Needs less force.',
  description: 'She swipes rather than presses.',
  intended_use: null,
  primary_user: null,
  contact_prefs: [],
  status: 'challenge',
  kind: 'challenge',
  tutorial_id: null,
  participants: [],
  maker_count: 0,
  answer_count: 0,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  ...over,
})
const joinedDetail = (over: object = {}) => detail({ participants: [{ profile_id: 'viewer1', name: 'Viewer', joined_at: '2026-08-03T00:00:00Z', role: 'contributor' }], maker_count: 1, ...over })
const msg = (id: string, body: string, over: object = {}) => ({ id, idea_id: 'c1', sender_id: 'author1', kind: 'user', body, created_at: '2026-08-02T03:00:00Z', ...over })

function respond(brief: object, messages: unknown[] = [], mine?: object) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/public/challenges/c1'
      ? Promise.resolve(brief)
      : path === '/api/ideas/c1/messages'
        ? Promise.resolve(messages)
        : path === '/api/ideas/mine/c1' && mine
          ? Promise.resolve(mine)
          : Promise.reject(path === '/api/ideas/mine/c1' ? notFound() : new Error(`unexpected GET ${path}`))
  )
}
const tab = (name: string) => screen.findByRole('tab', { name })
const openThread = async () => fireEvent.press(await tab('Thread'))

beforeEach(() => {
  for (const m of [mockGet, mockPost, mockDelete, mockPush, mockRecord, mockToggle, mockConfirm]) m.mockReset()
  mockSaved = false
  mockCaps.mockReturnValue(viewer('viewer1'))
  mockPost.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
  respond(detail())
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('who is looking at an open challenge', () => {
  it('asks a signed-out reader to sign in, offers no join, and never asks for the thread', async () => {
    mockCaps.mockReturnValue(signedOut)
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Sign in to see the conversation and join this challenge.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Join/ })).toBeNull()
    expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/c1/messages')
  })

  it('offers a stranger Join this challenge on a build challenge and Join to answer on a question', async () => {
    const { unmount } = render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('button', { name: 'Join this challenge' })).toBeTruthy()
    unmount()
    respond(detail({ kind: 'question' }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('button', { name: 'Join to answer' })).toBeTruthy()
  })

  it('gives the author neither Join nor Leave on their own open challenge', async () => {
    mockCaps.mockReturnValue(viewer('author1'))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('This is your challenge.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Join/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull()
  })

  it('joins once however many times Join is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Join this challenge' }))
    fireEvent.press(screen.getByRole('button', { name: 'Join this challenge' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/join', {})
    await act(async () => finish({}))
  })

  it('says it could not join and leaves Join usable, then clears the message on a good retry', async () => {
    mockPost.mockRejectedValueOnce(new Error('failed with status 403: Not allowed.')).mockResolvedValueOnce({})
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Join this challenge' }))
    expect(await screen.findByText('Could not join this challenge. Please try again.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Join this challenge' }))
    await waitFor(() => expect(screen.queryByText('Could not join this challenge. Please try again.')).toBeNull())
  })

  it('C04 says it could not leave when the delete fails, and stays joined', async () => {
    respond(joinedDetail())
    mockDelete.mockRejectedValue(new Error('500'))
    mockConfirm.mockImplementation((_t, _m, _l, onConfirm: () => void) => onConfirm())
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Leave' }))
    expect(await screen.findByText('Could not leave this challenge. Please try again.')).toBeTruthy()
    expect(screen.getByText('✓ You joined')).toBeTruthy()
    expect(mockDelete).toHaveBeenCalledWith('/api/ideas/c1/participants/viewer1')
  })

  it('C04 does not leave until the confirmation is accepted', async () => {
    respond(joinedDetail())
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Leave' }))
    expect(mockConfirm).toHaveBeenCalledWith('Leave this challenge?', 'You will stop taking part in its conversation.', 'Leave', expect.any(Function))
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('an ended challenge', () => {
  const written = (over: object = {}) => detail({ status: 'graduated', tutorial_id: 'g9', ...over })

  it('offers a stranger Follow the write-up and no join, and links the guide', async () => {
    respond(written())
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('button', { name: 'Follow the write-up' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Join/ })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Read the guide' }))
    expect(mockPush).toHaveBeenCalledWith('/guides/g9')
  })

  it('saves on Follow, tells the reader, and does not unsave on a second Follow once saved', async () => {
    respond(written())
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Follow the write-up' }))
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith('challenges', 'c1'))
    expect(await screen.findByText('You will be told when the guide is published')).toBeTruthy()
    mockToggle.mockClear()
    mockSaved = true
    fireEvent.press(screen.getByRole('button', { name: 'Follow the write-up' }))
    await screen.findByText('You will be told when the guide is published')
    expect(mockToggle).not.toHaveBeenCalled()
  })

  it('still lets a maker who joined leave, and read the thread, after it graduated', async () => {
    respond(written({ participants: [{ profile_id: 'viewer1', name: 'Viewer' }] }), [msg('m1', 'Draft is up')])
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('button', { name: 'Leave' })).toBeTruthy()
    await openThread()
    expect(await screen.findByLabelText('Priya said: Draft is up')).toBeTruthy()
  })

  it('says it is being written up, names the writer, and drops the days-open tile', async () => {
    respond(written({ writing_up: { profile_id: 'p1', name: 'Tom Beattie', started_at: '2026-09-02T03:00:00Z' } }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Somebody solved it')).toBeTruthy()
    expect(screen.getByText('Tom Beattie is writing this up')).toBeTruthy()
    expect(screen.queryByText(/days? open/)).toBeNull()
  })

  it('says an answered question is answered, and that the thread stays open to read', async () => {
    respond(detail({ kind: 'question', answer_message_id: 'm1' }))
    render(<ChallengeDetailScreen id="c1" />)
    expect((await screen.findAllByText('Answered')).length).toBeGreaterThan(0)
    expect(screen.getByText('The asker marked the reply that helped. The thread stays open to read.')).toBeTruthy()
  })

  it('says an unanswered question is waiting, and an open challenge is waiting for a maker or has makers', async () => {
    respond(detail({ kind: 'question' }))
    const a = render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Open, waiting for an answer')).toBeTruthy()
    a.unmount()
    respond(detail())
    const b = render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Open, waiting for a maker')).toBeTruthy()
    b.unmount()
    respond(detail({ maker_count: 3 }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Open, and makers are on it')).toBeTruthy()
  })
})

describe('the author’s idea before it is public', () => {
  beforeEach(() => mockCaps.mockReturnValue(viewer('author1')))
  const gone = () => mockGet.mockImplementation((p: string) => (p === '/api/public/challenges/c1' ? Promise.reject(notFound()) : Promise.resolve(detail({ status: 'pending' }))))

  it('shows a pending idea with no Makers or Thread tab and no stat tiles', async () => {
    gone()
    render(<ChallengeDetailScreen id="c1" />)
    await screen.findByText('An admin is reading it')
    expect(screen.queryByRole('tab', { name: 'Makers' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Thread' })).toBeNull()
    expect(screen.queryByText('makers')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Join/ })).toBeNull()
  })

  it('shows a rejected idea with no reason block when the admin left no note', async () => {
    mockGet.mockImplementation((p: string) => (p === '/api/ideas/mine/c1' ? Promise.resolve(detail({ status: 'rejected', review_note: null })) : Promise.reject(notFound())))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Not taken forward')).toBeTruthy()
    expect(screen.queryByText('Why it was not taken forward:')).toBeNull()
  })

  it('shows the reviewer’s note as plain text, markup and all', async () => {
    mockGet.mockImplementation((p: string) =>
      p === '/api/ideas/mine/c1' ? Promise.resolve(detail({ status: 'rejected', review_note: '<b>No</b> & "never"' })) : Promise.reject(notFound())
    )
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('<b>No</b> & "never"')).toBeTruthy()
  })

  it('says it could not load when neither the public brief nor the author’s copy answers', async () => {
    mockGet.mockRejectedValue(notFound())
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText("Couldn't load this challenge.")).toBeTruthy()
  })

  it('says it could not load, without trying the author’s copy, when the public read fails for a reason other than 404', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/mine/c1')
  })

  it('does not show a stranger someone else’s pending idea', async () => {
    mockCaps.mockReturnValue(viewer('someone-else'))
    mockGet.mockImplementation((p: string) => (p === '/api/public/challenges/c1' ? Promise.reject(notFound()) : Promise.reject(notFound())))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText("Couldn't load this challenge.")).toBeTruthy()
  })
})

describe('tabs and counts', () => {
  it('puts a count on Makers, Thread and Constraints only when there is something to count', async () => {
    respond(detail({ maker_count: 2, answer_count: 5, constraints: [{ id: 'k1', label: 'No glue', note: null }] }))
    render(<ChallengeDetailScreen id="c1" />)
    expect((await tab('Makers')).props.accessibilityValue.text).toBe('2')
    expect(screen.getByRole('tab', { name: 'Thread' }).props.accessibilityValue.text).toBe('5')
    expect(screen.getByRole('tab', { name: 'Constraints' }).props.accessibilityValue.text).toBe('1')
    expect(screen.getByRole('tab', { name: 'Brief' }).props.accessibilityValue.text).toBeUndefined()
  })

  it('has no count on any tab for a brand-new challenge', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    for (const name of ['Makers', 'Thread', 'Constraints']) expect((await tab(name)).props.accessibilityValue.text).toBeUndefined()
  })

  it('falls back to the participant count for Makers when the brief carries no maker count', async () => {
    respond(detail({ maker_count: undefined, participants: [{ profile_id: 'a', name: 'A', joined_at: '2026-08-03T00:00:00Z' }, { profile_id: 'b', name: 'B', joined_at: '2026-08-04T00:00:00Z' }] }))
    render(<ChallengeDetailScreen id="c1" />)
    expect((await tab('Makers')).props.accessibilityValue.text).toBe('2')
  })

  it('shows the Outcome tab for a build challenge, with the first two steps done once it is graduated', async () => {
    respond(detail({ status: 'graduated' }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Outcome'))
    for (const label of ['Idea approved', 'Makers working', 'Written up as a guide', 'Guide published']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.UNSAFE_getAllByProps({ name: 'checkmark' })).toHaveLength(2)
  })

  it('shows every Outcome step still to do for a rejected idea', async () => {
    mockCaps.mockReturnValue(viewer('author1'))
    mockGet.mockImplementation((p: string) =>
      p === '/api/ideas/mine/c1' ? Promise.resolve(detail({ status: 'rejected' })) : Promise.reject(notFound())
    )
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Outcome'))
    expect(screen.UNSAFE_queryAllByProps({ name: 'checkmark' })).toHaveLength(0)
    expect(screen.UNSAFE_getAllByProps({ name: 'remove' })).toHaveLength(4)
  })

  it('has no Outcome tab for a question', async () => {
    respond(detail({ kind: 'question' }))
    render(<ChallengeDetailScreen id="c1" />)
    await tab('Status')
    expect(screen.queryByRole('tab', { name: 'Outcome' })).toBeNull()
  })
})

describe('the brief', () => {
  it('shows an anonymous challenge as by "anonymous"', async () => {
    respond(detail({ author_id: null, author_name: null }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText(/· anonymous$/)).toBeTruthy()
  })

  it('leaves out "The problem" when the description is empty', async () => {
    respond(detail({ description: '' }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Brief'))
    expect(screen.queryByText('The problem')).toBeNull()
    expect(screen.getByText('What a solution has to do')).toBeTruthy()
  })

  it.each(NAMES)('shows a title, summary and description with $label as typed', async ({ value }) => {
    respond(detail({ title: value, summary: value, description: value }))
    render(<ChallengeDetailScreen id="c1" />)
    expect((await screen.findAllByText(value)).length).toBeGreaterThan(0)
    fireEvent.press(await tab('Brief'))
    expect(screen.getAllByText(value).length).toBeGreaterThan(1)
  })

  it('lists no contact preferences block when the author picked none', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Makers'))
    expect(screen.queryByText('The author is happy to help with')).toBeNull()
    expect(screen.getByText('Nobody has joined yet.')).toBeTruthy()
  })

  it('labels every contact preference', async () => {
    respond(detail({ contact_prefs: ['clarification', 'co_design', 'user_testing'] }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Makers'))
    for (const l of ['Clarification', 'Co-design', 'User testing']) expect(screen.getByText(l)).toBeTruthy()
  })

  it('names a maker with no profile name "Someone" and an admin "Admin"', async () => {
    respond(detail({ participants: [{ profile_id: 'p1', name: null, role: 'admin', joined_at: '2026-08-04T12:00:00' }] }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Makers'))
    expect(screen.getByText('Someone')).toBeTruthy()
    expect(screen.getByText(/^Admin · joined \d{1,2} \w{3}$/)).toBeTruthy()
  })

  it('records it in recents once, with the question or challenge word and the join count', async () => {
    respond(detail({ kind: 'question', maker_count: 2 }))
    render(<ChallengeDetailScreen id="c1" />)
    await screen.findByText('A switch a toddler can hit')
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', kind: 'challenge', subtitle: 'Question · 2 joined', href: '/explore/challenges/c1' }))
  })

  it('leaves the join count out of the recents subtitle when nobody has joined', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    await screen.findByText('A switch a toddler can hit')
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ subtitle: 'Challenge' }))
  })
})

describe('constraints', () => {
  const add = () => fireEvent.press(screen.getByRole('button', { name: 'Add a constraint' }))
  const open = async (brief = joinedDetail()) => {
    respond(brief)
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await tab('Constraints'))
  }

  it('shows the form to a joined maker and to the author, and to nobody else', async () => {
    await open()
    expect(screen.getByLabelText('Constraint')).toBeTruthy()
  })

  it('shows no form to a stranger or a signed-out reader', async () => {
    await open(detail())
    expect(screen.queryByLabelText('Constraint')).toBeNull()
  })

  it('shows the form to the author of an open challenge', async () => {
    mockCaps.mockReturnValue(viewer('author1'))
    await open(detail())
    expect(screen.getByLabelText('Constraint')).toBeTruthy()
  })

  it.each(['', '   ', '\n\t'])('keeps Add off for a label of %p', async (typed) => {
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), typed)
    expect(screen.getByRole('button', { name: 'Add a constraint' })).toBeDisabled()
    add()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends the label and note trimmed, a blank note as null, then clears the boxes and reloads the brief', async () => {
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), '  No glue  ')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/constraints', { label: 'No glue', note: null }))
    await waitFor(() => expect(screen.getByLabelText('Constraint').props.value).toBe(''))
  })

  it('sends a note when one was given', async () => {
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), 'No glue')
    fireEvent.changeText(screen.getByLabelText('Note (optional)'), '  She chews it  ')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/constraints', { label: 'No glue', note: 'She chews it' }))
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value && n.label !== 'very long'))('sends a constraint with $label as typed', async ({ value }) => {
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), value)
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/constraints', { label: value, note: null }))
  })

  it('caps the label at 80 characters and the note at 300', async () => {
    await open()
    expect(screen.getByLabelText('Constraint').props.maxLength).toBe(80)
    expect(screen.getByLabelText('Note (optional)').props.maxLength).toBe(300)
  })

  it('keeps what was typed and says so when adding fails', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 400: Too many constraints.'))
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), 'No glue')
    add()
    expect(await screen.findByText('Could not add that constraint. Please try again.')).toBeTruthy()
    expect(screen.getByLabelText('Constraint').props.value).toBe('No glue')
  })

  it('adds once however many times Add is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    await open()
    fireEvent.changeText(screen.getByLabelText('Constraint'), 'No glue')
    add()
    add()
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
  })

  it('shows constraints in order with their notes, and skips a missing note', async () => {
    await open(joinedDetail({ constraints: [{ id: 'k1', label: 'No glue', note: 'She chews it' }, { id: 'k2', label: 'Under $5', note: null }] }))
    expect(screen.getByText('No glue')).toBeTruthy()
    expect(screen.getByText('She chews it')).toBeTruthy()
    expect(screen.getByText('Under $5')).toBeTruthy()
  })

  it('falls back to intended use and who it is for only when there are no constraints, and to nothing when neither is set', async () => {
    await open(joinedDetail({ intended_use: 'Bubbles', primary_user: null }))
    expect(screen.getByText('Intended use')).toBeTruthy()
    expect(screen.queryByText("Who it's for")).toBeNull()
  })
})

describe('the thread', () => {
  const inThread = async (messages: unknown[] = [], brief = joinedDetail()) => {
    respond(brief, messages)
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    return screen.findByLabelText('Message this challenge')
  }

  it('says no messages yet, with an invitation, to a maker in an empty thread', async () => {
    await inThread()
    expect(screen.getByText('No messages yet. Say what you are trying.')).toBeTruthy()
  })

  it('keeps Send off for empty and whitespace-only messages', async () => {
    const box = await inThread()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.changeText(box, '  \n ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows no composer to a stranger and no thread content', async () => {
    respond(detail())
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    expect(screen.queryByLabelText('Message this challenge')).toBeNull()
    expect(screen.queryByText('No messages yet. Say what you are trying.')).toBeNull()
  })

  it('shows no composer on any other tab', async () => {
    await inThread()
    fireEvent.press(await tab('Brief'))
    expect(screen.queryByLabelText('Message this challenge')).toBeNull()
  })

  it('sends the message trimmed, shows it as the viewer’s own, and empties the box', async () => {
    mockPost.mockResolvedValue(msg('m9', 'Try a lever', { sender_id: 'viewer1' }))
    const box = await inThread()
    fireEvent.changeText(box, '  Try a lever  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/messages', { body: 'Try a lever' }))
    expect(await screen.findByLabelText('You said: Try a lever')).toBeTruthy()
    expect(screen.getByLabelText('Message this challenge').props.value).toBe('')
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('sends and shows a message with $label as typed', async ({ value }) => {
    mockPost.mockResolvedValue(msg('m9', value, { sender_id: 'viewer1' }))
    const box = await inThread()
    fireEvent.changeText(box, value)
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/messages', { body: value }))
    expect(await screen.findByLabelText(`You said: ${value}`)).toBeTruthy()
  })

  it('sends one message however many times Send is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    const box = await inThread()
    fireEvent.changeText(box, 'hello')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(msg('m9', 'hello', { sender_id: 'viewer1' })))
  })

  it('keeps the draft and says so when sending fails, then sends it on retry', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(msg('m9', 'hi', { sender_id: 'viewer1' }))
    const box = await inThread()
    fireEvent.changeText(box, 'hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Could not send that message. Please try again.')).toBeTruthy()
    expect(screen.getByLabelText('Message this challenge').props.value).toBe('hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByLabelText('You said: hi')).toBeTruthy()
  })

  it('shows a system line unattributed and a message from someone who left as "Someone"', async () => {
    await inThread([msg('m1', 'Priya joined', { kind: 'system' }), msg('m2', 'Hello', { sender_id: 'gone' })])
    expect(await screen.findByText('Priya joined')).toBeTruthy()
    expect(screen.getByLabelText('Someone said: Hello')).toBeTruthy()
  })

  it('names the author from the brief, falling back to the viewer’s own name on their own anonymous idea', async () => {
    mockCaps.mockReturnValue(viewer('author1'))
    respond(detail({ author_id: null, author_name: null }), [msg('m1', 'Mine', { sender_id: 'author1' })], detail())
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    expect(await screen.findByLabelText('You said: Mine')).toBeTruthy()
  })

  it('does not show an error banner when a poll fails, and keeps the messages it had', async () => {
    jest.useFakeTimers()
    respond(joinedDetail(), [msg('m1', 'First')])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    await screen.findByLabelText('Priya said: First')
    mockGet.mockImplementation((p: string) => (p === '/api/ideas/c1/messages' ? Promise.reject(new Error('Network request failed')) : Promise.resolve(joinedDetail())))
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(screen.getByLabelText('Priya said: First')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('picks up a new message on the next poll', async () => {
    jest.useFakeTimers()
    respond(joinedDetail(), [msg('m1', 'First')])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    await screen.findByLabelText('Priya said: First')
    respond(joinedDetail(), [msg('m1', 'First'), msg('m2', 'Second')])
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(await screen.findByLabelText('Priya said: Second')).toBeTruthy()
  })
})

describe('marking an answer', () => {
  const question = (over: object = {}) => detail({ kind: 'question', participants: [{ profile_id: 'p1', name: 'Sam' }], ...over })
  beforeEach(() => mockCaps.mockReturnValue(viewer('author1')))

  it('offers Mark as the answer on a reply, never on the asker’s own message', async () => {
    respond(question(), [msg('m1', 'My question', { sender_id: 'author1' }), msg('m2', 'Try this', { sender_id: 'p1' })])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    await screen.findByLabelText('Sam said: Try this')
    expect(screen.getAllByRole('button', { name: 'Mark as the answer' })).toHaveLength(1)
  })

  it('offers it on no system line', async () => {
    respond(question(), [msg('m2', 'Sam joined', { sender_id: 'p1', kind: 'system' })])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    await screen.findByText('Sam joined')
    expect(screen.queryByRole('button', { name: 'Mark as the answer' })).toBeNull()
  })

  it('says it could not mark the answer when the API refuses, and Unmark clears it with a null id', async () => {
    mockPost.mockRejectedValueOnce(new Error('403')).mockResolvedValue({})
    respond(question(), [msg('m2', 'Try this', { sender_id: 'p1' })])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    fireEvent.press(await screen.findByRole('button', { name: 'Mark as the answer' }))
    expect(await screen.findByText('Could not mark the answer. Please try again.')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/answer', { message_id: 'm2' })
    respond(question({ answer_message_id: 'm2' }), [msg('m2', 'Try this', { sender_id: 'p1' })])
    fireEvent.press(screen.getByRole('button', { name: 'Mark as the answer' }))
    fireEvent.press(await screen.findByRole('button', { name: 'Unmark' }))
    await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/api/ideas/c1/answer', { message_id: null }))
  })

  it('shows the marked answer to a reader who is not the asker, with no controls', async () => {
    mockCaps.mockReturnValue(viewer('p1'))
    respond(question({ answer_message_id: 'm2' }), [msg('m2', 'Try this', { sender_id: 'p1' })])
    render(<ChallengeDetailScreen id="c1" />)
    await openThread()
    expect(await screen.findByText('The answer · marked by the asker')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unmark' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark as the answer' })).toBeNull()
  })
})

describe('withdrawing an idea', () => {
  const pending = () => {
    mockCaps.mockReturnValue(viewer('author1'))
    mockGet.mockImplementation((p: string) => (p === '/api/ideas/mine/c1' ? Promise.resolve(detail({ status: 'pending' })) : Promise.reject(notFound())))
  }

  it('withdraws once however many times it is tapped while it is in flight', async () => {
    pending()
    let finish!: (v?: unknown) => void
    mockDelete.mockReturnValue(new Promise((r) => (finish = r)))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Withdraw the idea' }))
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw the idea' }))
    expect(mockDelete).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(await screen.findByText('Withdrawn — nothing was published')).toBeTruthy()
  })

  it('clears the failure line when a later withdraw works', async () => {
    pending()
    mockDelete.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(undefined)
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Withdraw the idea' }))
    await screen.findByText('Could not withdraw this idea. Please try again.')
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw the idea' }))
    expect(await screen.findByText('Withdrawn — nothing was published')).toBeTruthy()
  })
})
