// Outlier input and failure paths on the exchange thread: what is typed into
// the composer and the code box, what a second tap does, and what a flaky
// network leaves on screen. The happy paths live in thread-screen.test.tsx.
// journeys: X03
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ExchangeThreadScreen } from '../../../../components/exchanges/thread-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  }
})
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
let mockLed: { id: string }[] = []
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({
    caps: { profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' }, isAdmin: false, ledOrgs: mockLed, unread: { total: 0 }, exchangeActions: 0 },
    loading: false,
    refresh: jest.fn(),
  }),
}))

const detail = (over: object = {}) => ({
  id: 'tx1', toy_id: 'toy1', offered_toy_id: null, type: 'donation', status: 'requested',
  requester_id: 'requester1', owner_id: 'viewer1', owner_org_id: null, owner_code: null, requester_code: null,
  owner_confirmed_at: null, requester_confirmed_at: null, pickup_line1: null, pickup_suburb: null,
  pickup_state: null, pickup_postcode: null, pickup_instructions: null,
  created_at: '2026-08-30T01:00:00.000Z', updated_at: '2026-08-30T01:00:00.000Z',
  toy_name: 'Bubble machine', offered_toy_name: null, owner_name: 'Ash', requester_name: 'Jamie',
  blocked_by_rival_accept: false, received_toy: null, messages: [], ...over,
})
const accepted = (over: object = {}) => detail({ status: 'accepted', owner_code: '123456', ...over })
const message = (over: object) => ({
  id: 'm1', transaction_id: 'tx1', sender_id: 'requester1', kind: 'user', body: 'Hello',
  created_at: '2026-08-30T01:00:00.000Z', ...over,
})

async function open() {
  render(<ExchangeThreadScreen id="tx1" />)
  await screen.findByText(/Bubble machine/)
}
const send = () => screen.getByRole('button', { name: 'Send' })
const type = (text: string) => fireEvent.changeText(screen.getByLabelText('Message Jamie'), text)

beforeEach(() => {
  jest.clearAllMocks()
  mockLed = []
  mockGet.mockResolvedValue(detail())
})

describe('the composer', () => {
  it('keeps Send held for whitespace-only text', async () => {
    await open()
    type('   \n\t  ')
    expect(send().props.accessibilityState.disabled).toBe(true)
    fireEvent.press(send())
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends the message without the spaces and newlines around it', async () => {
    mockPost.mockResolvedValue(message({ id: 'm9', sender_id: 'viewer1', body: 'See you at 3' }))
    await open()
    type('  \nSee you at 3\n  ')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/messages', { body: 'See you at 3' }))
  })

  it.each([...NAMES.filter((n) => !/spaces/.test(n.label)), { label: 'quotes and brackets', value: `He said "<a href='x'>&amp;</a>" \\ 50%` }])(
    'sends and draws $label text exactly as typed',
    async ({ value }) => {
      mockPost.mockResolvedValue(message({ id: 'm9', sender_id: 'viewer1', body: value }))
      await open()
      type(value)
      fireEvent.press(send())
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/messages', { body: value }))
      expect(await screen.findByText(value)).toBeTruthy()
    }
  )

  it('sends a very long message whole rather than cutting it', async () => {
    const long = 'word '.repeat(2000).trim()
    mockPost.mockResolvedValue(message({ id: 'm9', sender_id: 'viewer1', body: long }))
    await open()
    type(long)
    fireEvent.press(send())
    await waitFor(() => expect(mockPost.mock.calls[0][1].body).toHaveLength(long.length))
  })

  it('posts once when Send is pressed twice before the first answer', async () => {
    let resolve!: (m: object) => void
    mockPost.mockReturnValue(new Promise((r) => (resolve = r)))
    await open()
    type('Hi there')
    fireEvent.press(send())
    fireEvent.press(send())
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => resolve(message({ id: 'm9', sender_id: 'viewer1', body: 'Hi there' })))
    expect(screen.getAllByText('Hi there')).toHaveLength(1)
  })

  it('keeps what was typed when the send fails, says so, and sends it on retry', async () => {
    mockPost.mockRejectedValueOnce(new Error('API POST /x failed with status 500: relation does not exist'))
    mockPost.mockResolvedValueOnce(message({ id: 'm9', sender_id: 'viewer1', body: 'Still on' }))
    await open()
    type('Still on')
    fireEvent.press(send())
    // A raw 5xx is not copy, so the generic line stands in for it.
    expect(await screen.findByText('Could not send that message. Please try again.')).toBeTruthy()
    expect(screen.queryByText(/relation does not exist/)).toBeNull()
    expect(screen.getByLabelText('Message Jamie').props.value).toBe('Still on')
    expect(screen.queryByText('Still on', { exact: true })).toBeNull()
    fireEvent.press(send())
    expect(await screen.findByText('Still on')).toBeTruthy()
    expect(screen.getByLabelText('Message Jamie').props.value).toBe('')
    expect(screen.queryByText('Could not send that message. Please try again.')).toBeNull()
  })

  it('shows the API reason when it refuses the message', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/toy-transactions/tx1/messages failed with status 404: Not found'))
    await open()
    type('Hello?')
    fireEvent.press(send())
    expect(await screen.findByText('Not found')).toBeTruthy()
  })

  it('says the phone is offline, and keeps the draft, when the request never leaves it', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    await open()
    type('Anyone there?')
    fireEvent.press(send())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByLabelText('Message Jamie').props.value).toBe('Anyone there?')
  })

  it('asks the sender to wait when the API rate-limits the message', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 429'))
    await open()
    type('Hi')
    fireEvent.press(send())
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
  })
})

describe('an empty or one-message thread', () => {
  it('draws the composer and no bubbles when nobody has said anything', async () => {
    await open()
    expect(screen.getByLabelText('Conversation').children).toHaveLength(0)
    expect(screen.getByLabelText('Message Jamie')).toBeTruthy()
  })

  it('draws a single message', async () => {
    mockGet.mockResolvedValue(detail({ messages: [message({ body: 'Only one' })] }))
    await open()
    expect(screen.getAllByText('Only one')).toHaveLength(1)
  })

  it('reads a long RTL and emoji message from the other side verbatim', async () => {
    const body = 'سارة 🧸 <b>&</b> ' + 'x'.repeat(1500)
    mockGet.mockResolvedValue(detail({ messages: [message({ body })] }))
    await open()
    expect(screen.getByText(body)).toBeTruthy()
  })
})

describe('the handover code box', () => {
  const code = () => screen.getByLabelText('Enter their code')
  const confirm = () => screen.getByRole('button', { name: 'Confirm handoff' })

  it('sends the code without spaces pasted around it', async () => {
    mockGet.mockResolvedValue(accepted())
    mockPost.mockResolvedValue({})
    await open()
    fireEvent.changeText(code(), ' 654321 ')
    fireEvent.press(confirm())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/confirm', { code: '654321' }))
  })

  it('holds Confirm for a code that is only spaces', async () => {
    mockGet.mockResolvedValue(accepted())
    await open()
    fireEvent.changeText(code(), '      ')
    expect(confirm().props.accessibilityState.disabled).toBe(true)
  })

  it('confirms once when pressed twice before the first answer', async () => {
    mockGet.mockResolvedValue(accepted())
    mockPost.mockReturnValue(new Promise(() => {}))
    await open()
    fireEvent.changeText(code(), '654321')
    fireEvent.press(confirm())
    fireEvent.press(confirm())
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('keeps a short or wrong code in the box after the API says Incorrect code', async () => {
    mockGet.mockResolvedValue(accepted())
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: Incorrect code'))
    await open()
    fireEvent.changeText(code(), '12')
    fireEvent.press(confirm())
    expect(await screen.findByText('Incorrect code')).toBeTruthy()
    expect(code().props.value).toBe('12')
  })

  it('clears the code box once the confirmation is taken', async () => {
    mockGet.mockResolvedValue(accepted())
    mockPost.mockResolvedValue({ owner_confirmed_at: '2026-08-30T02:00:00.000Z' })
    await open()
    fireEvent.changeText(code(), '654321')
    fireEvent.press(confirm())
    expect(await screen.findByText('Waiting on the other side to confirm')).toBeTruthy()
  })

  it('says the new code failed, and keeps showing the old one, when the request errors', async () => {
    mockGet.mockResolvedValue(accepted({ type: 'exchange', requester_code: '111222', owner_code: '333444' }))
    mockPost.mockRejectedValue(new Error('Network request failed'))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'New code' }))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByLabelText('3 3 3 4 4 4')).toBeTruthy()
    expect(screen.queryByText('New code — the old one no longer works')).toBeNull()
  })
})

describe('actions that can be tapped twice', () => {
  it('accepts an organisation request once when Accept is pressed twice', async () => {
    mockGet.mockResolvedValue(detail({ owner_id: null, owner_org_id: 'org1' }))
    mockPost.mockReturnValue(new Promise(() => {}))
    mockLed = [{ id: 'org1' }]
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/accept', {})
  })

  it('declines once when Decline is pressed twice', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.press(screen.getByRole('button', { name: 'Decline' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('withdraws once when Withdraw is pressed twice', async () => {
    mockGet.mockResolvedValue(detail({ owner_id: 'o', requester_id: 'viewer1' }))
    mockPost.mockReturnValue(new Promise(() => {}))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }))
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('shows the API reason and keeps the Decline button when declining fails', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 409: Already answered'))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Decline' }))
    expect(await screen.findByText('Already answered')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decline' }).props.accessibilityState.disabled).toBeFalsy()
  })
})

describe('the pickup form with awkward addresses', () => {
  it('holds Accept while a field holds only spaces', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    for (const [label, v] of Object.entries({ 'Street address': '12 Rose St', Suburb: 'Fitzroy', State: 'VIC', Postcode: '3065' })) {
      fireEvent.changeText(screen.getByLabelText(label), v)
    }
    fireEvent.changeText(screen.getByLabelText('Suburb'), '    ')
    expect(screen.getByRole('button', { name: 'Accept request' }).props.accessibilityState.disabled).toBe(true)
  })

  it('posts an apostrophe, an ampersand and a unicode street name as typed', async () => {
    mockPost.mockResolvedValue({ status: 'accepted' })
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    const fields = { 'Street address': "5/12 O'Brien & Sons Rd 李雷", Suburb: 'Zoë', State: 'VIC', Postcode: '3065' }
    for (const [label, v] of Object.entries(fields)) fireEvent.changeText(screen.getByLabelText(label), v)
    fireEvent.press(screen.getByRole('button', { name: 'Accept request' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][0]).toBe('/api/toy-transactions/tx1/accept')
    expect(mockPost.mock.calls[0][1]).toEqual({
      pickup_line1: fields['Street address'], pickup_suburb: 'Zoë', pickup_state: 'VIC', pickup_postcode: '3065',
    })
  })
})

describe('a flaky connection', () => {
  it('keeps the thread on screen when a later poll fails, and clears the warning when the next one lands', async () => {
    jest.useFakeTimers()
    try {
      mockGet.mockResolvedValueOnce(detail({ messages: [message({ body: 'Before the drop' })] }))
      render(<ExchangeThreadScreen id="tx1" />)
      await act(async () => {})
      expect(screen.getByText('Before the drop')).toBeTruthy()

      jest.spyOn(console, 'error').mockImplementation(() => {})
      mockGet.mockRejectedValueOnce(new Error('offline'))
      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(screen.getByText("Couldn't load this exchange.")).toBeTruthy()
      expect(screen.getByText('Before the drop')).toBeTruthy()

      mockGet.mockResolvedValueOnce(detail({ messages: [message({ body: 'Before the drop' }), message({ id: 'm2', body: 'Back online' })] }))
      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(screen.queryByText("Couldn't load this exchange.")).toBeNull()
      expect(screen.getByText('Back online')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('offers Try again after a failed first load, and shows the thread once it works', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockRejectedValueOnce(new Error('offline'))
    render(<ExchangeThreadScreen id="tx1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/Bubble machine/)).toBeTruthy()
  })
})
