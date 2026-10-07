// Ask first: the maker's and the family's sides at their edges — no questions
// yet, a closed board, a failed send, a failed claim, odd message text.
// journeys: K04
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { AskFirstScreen } from '../../../../components/builds/ask-first-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ replace: mockReplace }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockCaps = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps() }))
const as = (id: string) => ({ caps: { profile: { id, name: 'Me' } } })

const msg = (id: string, sender: string, body: string) => ({ id, sender_id: sender, body, created_at: '2026-09-30T00:00:00Z' })
const thread = (maker: string, name: string, messages = [msg(`q-${maker}`, maker, 'Which switch?')]) => ({ maker_id: maker, maker_name: name, messages })
const questions = (over: object = {}) => ({
  transaction_id: 'b1',
  tutorial_title: 'Bubble machine',
  requester_suburb: 'Newtown',
  open: true,
  family: false,
  threads: [thread('m1', 'Tom')],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.mockReturnValue(as('m1'))
  mockGet.mockResolvedValue(questions())
  mockPost.mockResolvedValue({})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const type = (v: string) => fireEvent.changeText(screen.getByLabelText('Message'), v)
const send = () => fireEvent.press(screen.getByRole('button', { name: 'Send' }))

describe('loading', () => {
  it('says the board could not load when the read fails', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByText("Couldn't load the board.")).toBeTruthy()
  })

  it('shows the guide title as typed, including markup characters', async () => {
    mockGet.mockResolvedValue(questions({ tutorial_title: '<b>Bubble</b> & "Fan"' }))
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByText('<b>Bubble</b> & "Fan"')).toBeTruthy()
  })
})

describe('the maker’s side', () => {
  it('can write the first question on a board with no thread yet', async () => {
    mockGet.mockResolvedValue(questions({ threads: [] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByText('Not claimed yet')
    type('Do you have the switch?')
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Do you have the switch?' }))
  })

  it('names the other side "Family in <suburb>", or "your area" when the board has none', async () => {
    mockGet.mockResolvedValue(questions({ threads: [thread('m1', 'Tom', [msg('a', 'fam', 'The red one.')])] }))
    const { unmount } = render(<AskFirstScreen id="b1" />)
    expect(await screen.findByLabelText('Family in Newtown said: The red one.')).toBeTruthy()
    unmount()
    mockGet.mockResolvedValue(questions({ requester_suburb: null, threads: [thread('m1', 'Tom', [msg('a', 'fam', 'The red one.')])] }))
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByLabelText('Family in your area said: The red one.')).toBeTruthy()
  })

  it('shows the maker’s own messages as theirs, and none as "mine" before the profile loads', async () => {
    mockGet.mockResolvedValue(questions({ threads: [thread('m1', 'Tom', [msg('a', 'm1', 'Which switch?')])] }))
    const { unmount } = render(<AskFirstScreen id="b1" />)
    expect(await screen.findByLabelText('You said: Which switch?')).toBeTruthy()
    unmount()
    mockCaps.mockReturnValue({ caps: null })
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByLabelText(/said: Which switch\?$/)).toBeTruthy()
    expect(screen.queryByLabelText('You said: Which switch?')).toBeNull()
  })

  it('offers neither a composer nor a claim once the board is closed', async () => {
    mockGet.mockResolvedValue(questions({ open: false }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByText('Not claimed yet')
    expect(screen.queryByLabelText('Message')).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })

  it('keeps Send off for an empty or whitespace-only question and sends nothing', async () => {
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    type('   \n ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    send()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends the question trimmed, empties the box and re-reads the thread', async () => {
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    const reads = mockGet.mock.calls.length
    type('  Any batteries?  ')
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Any batteries?' }))
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(reads))
    expect(screen.getByLabelText('Message').props.value).toBe('')
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value && n.label !== 'very long'))('sends a question with $label as typed', async ({ value }) => {
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    type(value)
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: value }))
  })

  it('caps the question at 1000 characters, as the API does', async () => {
    render(<AskFirstScreen id="b1" />)
    expect((await screen.findByLabelText('Message')).props.maxLength).toBe(1000)
  })

  it('keeps the draft and shows the API’s sentence when the question is refused', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 409: This request was already claimed.'))
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    type('Hello')
    send()
    expect(await screen.findByText('This request was already claimed.')).toBeTruthy()
    expect(screen.getByLabelText('Message').props.value).toBe('Hello')
  })

  it.each([
    ['a 500', new Error('failed with status 500: boom'), 'Could not send that. Please try again.'],
    ['offline', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('shows the right sentence for %s on send', async (_l, failure, message) => {
    mockPost.mockRejectedValue(failure)
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    type('Hello')
    send()
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('sends one question however many times Send is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    type('Hello')
    send()
    send()
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
  })

  it('clears an earlier send error when the next send works', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce({})
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    type('Hello')
    send()
    await screen.findByText("You're offline. Check your connection and try again.")
    send()
    await waitFor(() => expect(screen.queryByText("You're offline. Check your connection and try again.")).toBeNull())
  })

  it('shows the API’s sentence and leaves the claim button usable when the claim is refused', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 409: Someone else claimed it first.'))
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    expect(await screen.findByText('Someone else claimed it first.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: "I'll build this" })).toBeEnabled()
  })

  it('shows the generic apology when the claim fails with a server error', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 500: boom'))
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    expect(await screen.findByText('That did not go through. Try once more.')).toBeTruthy()
  })

  it('claims once however many times the button is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<AskFirstScreen id="b1" />)
    const claim = await screen.findByRole('button', { name: "I'll build this" })
    fireEvent.press(claim)
    fireEvent.press(screen.getByRole('button', { name: "I'll build this" }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/claim', {})
    await act(async () => finish({}))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })
})

describe('the family’s side', () => {
  beforeEach(() => mockCaps.mockReturnValue(as('fam')))

  it('has no composer and no maker picker when no maker has asked yet', async () => {
    mockGet.mockResolvedValue(questions({ family: true, threads: [] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByText('Not claimed yet')
    expect(screen.queryByLabelText('Message')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('shows no maker picker for a single maker, and answers that maker', async () => {
    mockGet.mockResolvedValue(questions({ family: true, threads: [thread('m1', 'Tom')] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.queryByRole('radio')).toBeNull()
    type('The red one')
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'The red one', maker_id: 'm1' }))
  })

  it('starts on the first maker, and keeps the draft when the family switches maker', async () => {
    mockGet.mockResolvedValue(questions({ family: true, threads: [thread('m1', 'Tom'), thread('m2', 'Rachel')] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.getByRole('radio', { name: 'Tom' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Rachel' })).not.toBeSelected()
    expect(screen.getByLabelText('Tom said: Which switch?')).toBeTruthy()
    type('One draft')
    fireEvent.press(screen.getByRole('radio', { name: 'Rachel' }))
    expect(screen.getByLabelText('Rachel said: Which switch?')).toBeTruthy()
    expect(screen.queryByLabelText('Tom said: Which switch?')).toBeNull()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'One draft', maker_id: 'm2' }))
  })

  it('shows two makers who share a name as two choices', async () => {
    mockGet.mockResolvedValue(questions({ family: true, threads: [thread('m1', 'Sam'), thread('m2', 'Sam')] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.getAllByRole('radio', { name: 'Sam' })).toHaveLength(2)
  })

  it('offers the family no claim and no composer on a closed board', async () => {
    mockGet.mockResolvedValue(questions({ family: true, open: false, threads: [thread('m1', 'Tom')] }))
    render(<AskFirstScreen id="b1" />)
    await screen.findByText('Not claimed yet')
    expect(screen.queryByLabelText('Message')).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })

  it.each(NAMES)('shows a maker called $label as typed', async ({ value }) => {
    mockGet.mockResolvedValue(questions({ family: true, threads: [thread('m1', value), thread('m2', 'Other')] }))
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByRole('radio', { name: value })).toBeTruthy()
  })
})
