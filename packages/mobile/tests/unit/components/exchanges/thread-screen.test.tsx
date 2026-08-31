// packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx
//
// The state matrix of the exchange thread. Every case here is a combination of
// three axes the API itself branches on — status, which side the viewer is on,
// and donation vs exchange — because the wrong answer on any one of them puts
// two people in a room reciting a code that cannot match.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ExchangeThreadScreen } from '../../../../components/exchanges/thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// The thread pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by the thread itself) is what keeps that import inert, same as
// request-block.test.tsx does for the same transitive reason.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
  },
}))

// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — a plain mount-time useEffect stands in, same as
// exchanges/list-screen.test.tsx. The cleanup return is preserved, so the
// interval teardown is exercised too.
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    useRouter: () => ({ push: mockPush }),
  }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => mockUseCapabilities(),
}))

function caps(over: object, profileOver: object = {}) {
  return {
    caps: {
      profile: { id: 'viewer1', name: 'Viewer', role: 'contributor', ...profileOver },
      isAdmin: false,
      ledOrgs: [],
      unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
      exchangeActions: 0,
      ...over,
    },
    loading: false,
    refresh: jest.fn(),
  }
}

// viewer1 is the owner by default; every requester-side case flips owner_id.
const detail = (over: object) => ({
  id: 'tx1',
  toy_id: 'toy1',
  offered_toy_id: null,
  type: 'donation',
  status: 'requested',
  requester_id: 'requester1',
  owner_id: 'viewer1',
  owner_org_id: null,
  owner_code: null,
  requester_code: null,
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  pickup_line1: null,
  pickup_suburb: null,
  pickup_state: null,
  pickup_postcode: null,
  pickup_instructions: null,
  created_at: '2026-08-30T01:00:00.000Z',
  updated_at: '2026-08-30T01:00:00.000Z',
  toy_name: 'Bubble machine',
  offered_toy_name: null,
  owner_name: 'Ash',
  requester_name: 'Jamie',
  blocked_by_rival_accept: false,
  received_toy: null,
  messages: [],
  ...over,
})

const message = (over: object) => ({
  id: 'm1',
  transaction_id: 'tx1',
  sender_id: 'requester1',
  kind: 'user',
  body: 'Hello',
  created_at: '2026-08-30T01:00:00.000Z',
  ...over,
})

/** Renders and waits for the first GET to settle. */
async function open() {
  render(<ExchangeThreadScreen id="tx1" />)
  await screen.findByText(/Bubble machine/)
}

const ADDRESS = {
  'Street address': '12 Rose St',
  Suburb: 'Fitzroy',
  State: 'VIC',
  Postcode: '3065',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps({}))
  mockGet.mockResolvedValue(detail({}))
})

describe('ExchangeThreadScreen — loading and header', () => {
  it('fetches the transaction by id and names the toy and the collector on a donation', async () => {
    mockGet.mockResolvedValue(detail({ type: 'donation', owner_id: 'owner1', requester_id: 'viewer1' }))
    await open()
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/tx1')
    expect(screen.getByText('Bubble machine → You collect')).toBeTruthy()
  })

  it('names the requester as the collector when the viewer is the owner', async () => {
    mockGet.mockResolvedValue(detail({ type: 'donation' }))
    await open()
    expect(screen.getByText('Bubble machine → Jamie collects')).toBeTruthy()
  })

  it('swaps the two toys on an exchange', async () => {
    mockGet.mockResolvedValue(detail({ type: 'exchange', offered_toy_name: 'Fidget cube' }))
    await open()
    expect(screen.getByText('Bubble machine ⇄ Fidget cube')).toBeTruthy()
  })

  it('shows the status badge and the waiting line for the side being waited on', async () => {
    mockGet.mockResolvedValue(detail({ status: 'requested' }))
    await open()
    expect(screen.getByText('REQUESTED')).toBeTruthy()
    expect(screen.getByText('Waiting on you — accept or decline')).toBeTruthy()
  })

  it('names the other party in the waiting line when the ball is in their court', async () => {
    mockGet.mockResolvedValue(detail({ status: 'requested', owner_id: 'owner1', requester_id: 'viewer1' }))
    await open()
    expect(screen.getByText('Waiting on Ash')).toBeTruthy()
  })

  it('shows an error when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('API GET /api/toy-transactions/tx1 failed with status 500'))
    render(<ExchangeThreadScreen id="tx1" />)
    await waitFor(() => expect(screen.getByText("Couldn't load this exchange.")).toBeTruthy())
  })
})

describe('ExchangeThreadScreen — requested, owner side', () => {
  it('offers Accept and Decline to a person owner', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy()
    expect(screen.getByText('Accepting shares your pickup address and gives you both a handoff code.')).toBeTruthy()
  })

  it('opens the inline pickup form on Accept and holds the request until all four fields are filled', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByText('Where should they collect it?')).toBeTruthy()

    const submit = screen.getByRole('button', { name: 'Accept request' })
    expect(submit.props.accessibilityState.disabled).toBe(true)

    // Three of four is still not a place to meet — the API rejects it, so the
    // button must not offer to send it.
    fireEvent.changeText(screen.getByLabelText('Street address'), ADDRESS['Street address'])
    fireEvent.changeText(screen.getByLabelText('Suburb'), ADDRESS.Suburb)
    fireEvent.changeText(screen.getByLabelText('State'), ADDRESS.State)
    expect(screen.getByRole('button', { name: 'Accept request' }).props.accessibilityState.disabled).toBe(true)

    fireEvent.changeText(screen.getByLabelText('Postcode'), ADDRESS.Postcode)
    expect(
      screen.getByRole('button', { name: 'Accept request' }).props.accessibilityState.disabled
    ).toBeFalsy()
  })

  it('seeds the pickup form from the owner\'s saved profile address', async () => {
    mockUseCapabilities.mockReturnValue(
      caps(
        {},
        { pickup_line1: '9 Gertrude St', pickup_suburb: 'Collingwood', pickup_state: 'VIC', pickup_postcode: '3066' }
      )
    )
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByLabelText('Street address').props.value).toBe('9 Gertrude St')
    expect(screen.getByLabelText('Suburb').props.value).toBe('Collingwood')
    expect(screen.getByLabelText('State').props.value).toBe('VIC')
    expect(screen.getByLabelText('Postcode').props.value).toBe('3066')
    // Seeded, not fixed — the pickup is not always at home.
    expect(screen.getByRole('button', { name: 'Accept request' }).props.accessibilityState.disabled).toBeFalsy()
  })

  it('leaves the pickup form empty when the owner has saved no address', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByLabelText('Street address').props.value).toBe('')
    expect(screen.getByLabelText('Postcode').props.value).toBe('')
    expect(screen.getByRole('button', { name: 'Accept request' }).props.accessibilityState.disabled).toBe(true)
  })

  it('posts the four pickup fields and takes the accepted transaction from the response', async () => {
    mockPost.mockResolvedValue(
      detail({ status: 'accepted', owner_code: '123456', pickup_line1: '12 Rose St', pickup_suburb: 'Fitzroy', pickup_state: 'VIC', pickup_postcode: '3065' })
    )
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.changeText(screen.getByLabelText('Street address'), ADDRESS['Street address'])
    fireEvent.changeText(screen.getByLabelText('Suburb'), ADDRESS.Suburb)
    fireEvent.changeText(screen.getByLabelText('State'), ADDRESS.State)
    fireEvent.changeText(screen.getByLabelText('Postcode'), ADDRESS.Postcode)
    fireEvent.press(screen.getByRole('button', { name: 'Accept request' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/accept', {
        pickup_line1: '12 Rose St',
        pickup_suburb: 'Fitzroy',
        pickup_state: 'VIC',
        pickup_postcode: '3065',
      })
    )
    expect(await screen.findByText('ACCEPTED')).toBeTruthy()
  })

  it('accepts with an empty body and no address form when an organisation owns the toy', async () => {
    mockUseCapabilities.mockReturnValue(caps({ ledOrgs: [{ id: 'org1', name: 'TAD Australia' }] }))
    mockGet.mockResolvedValue(detail({ owner_id: null, owner_org_id: 'org1', owner_name: 'TAD Australia' }))
    mockPost.mockResolvedValue(detail({ owner_id: null, owner_org_id: 'org1', status: 'accepted' }))
    await open()
    expect(
      screen.getByText("Accepting shares your organisation's pickup address and gives you both a handoff code.")
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.queryByText('Where should they collect it?')).toBeNull()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/accept', {}))
  })

  it('declines through /reject', async () => {
    mockPost.mockResolvedValue(detail({ status: 'rejected' }))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/reject', {}))
    expect(await screen.findByText('REJECTED')).toBeTruthy()
  })

  it('surfaces an accept failure through the error row', async () => {
    mockUseCapabilities.mockReturnValue(caps({ ledOrgs: [{ id: 'org1', name: 'TAD Australia' }] }))
    mockGet.mockResolvedValue(detail({ owner_id: null, owner_org_id: 'org1' }))
    mockPost.mockRejectedValue(
      new Error(
        'API POST /api/toy-transactions/tx1/accept failed with status 400: Your organisation needs a pickup address before you can accept requests'
      )
    )
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(
      await screen.findByText('Your organisation needs a pickup address before you can accept requests')
    ).toBeTruthy()
  })

  it('keeps the typed address on screen when the accept is refused', async () => {
    mockPost.mockRejectedValue(
      new Error('API POST /api/toy-transactions/tx1/accept failed with status 409: This request is no longer open')
    )
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.changeText(screen.getByLabelText('Street address'), ADDRESS['Street address'])
    fireEvent.changeText(screen.getByLabelText('Suburb'), ADDRESS.Suburb)
    fireEvent.changeText(screen.getByLabelText('State'), ADDRESS.State)
    fireEvent.changeText(screen.getByLabelText('Postcode'), ADDRESS.Postcode)
    fireEvent.press(screen.getByRole('button', { name: 'Accept request' }))

    expect(await screen.findByText('This request is no longer open')).toBeTruthy()
    expect(screen.getByLabelText('Street address').props.value).toBe('12 Rose St')
  })

  it('blocks Accept while a rival request on the same toy is already accepted', async () => {
    mockGet.mockResolvedValue(detail({ blocked_by_rival_accept: true }))
    await open()
    expect(screen.getByRole('button', { name: 'Accept' }).props.accessibilityState.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Decline' }).props.accessibilityState.disabled).toBeFalsy()
  })
})

describe('ExchangeThreadScreen — requested, requester side', () => {
  it('offers Withdraw request and posts /withdraw, with no owner controls', async () => {
    mockGet.mockResolvedValue(detail({ owner_id: 'owner1', requester_id: 'viewer1' }))
    mockPost.mockResolvedValue(detail({ owner_id: 'owner1', requester_id: 'viewer1', status: 'withdrawn' }))
    await open()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/withdraw', {}))
    expect(await screen.findByText('WITHDRAWN')).toBeTruthy()
  })
})

describe('ExchangeThreadScreen — withdrawing while the transaction is open', () => {
  // The API allows withdraw on requested OR accepted from either side
  // (toy-transactions.ts:584-595). An accepted handoff that falls through
  // otherwise traps both parties and keeps the toy locked against rivals.
  it.each([
    ['requested', 'owner', {}],
    ['requested', 'requester', { owner_id: 'owner1', requester_id: 'viewer1' }],
    ['accepted', 'owner', { status: 'accepted' }],
    ['accepted', 'requester', { status: 'accepted', owner_id: 'owner1', requester_id: 'viewer1' }],
  ] as const)('offers it on a %s transaction from the %s side', async (_status, _side, over) => {
    mockGet.mockResolvedValue(detail({ ...over }))
    mockPost.mockResolvedValue(detail({ ...over, status: 'withdrawn' }))
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/withdraw', {}))
    expect(await screen.findByText('WITHDRAWN')).toBeTruthy()
  })

  it('stands down while the pickup form is open, where Cancel is the way back', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull()
  })
})

describe('ExchangeThreadScreen — accepted exchange, both sides confirm', () => {
  const accepted = (over: object) =>
    detail({
      type: 'exchange',
      status: 'accepted',
      offered_toy_name: 'Fidget cube',
      pickup_line1: '12 Rose St',
      pickup_suburb: 'Fitzroy',
      pickup_state: 'VIC',
      pickup_postcode: '3065',
      ...over,
    })

  it('shows the pickup address and the viewer\'s own code on the owner side', async () => {
    mockGet.mockResolvedValue(accepted({ owner_code: '123456', requester_code: null }))
    await open()
    expect(screen.getByText('12 Rose St, Fitzroy, VIC, 3065')).toBeTruthy()
    expect(screen.getByText(/Your handoff code/)).toBeTruthy()
    expect(screen.getByText('123456')).toBeTruthy()
  })

  it('shows the requester their own code too — an exchange is mutual', async () => {
    mockGet.mockResolvedValue(
      accepted({ owner_id: 'owner1', requester_id: 'viewer1', owner_code: null, requester_code: '654321' })
    )
    await open()
    expect(screen.getByText('654321')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm handoff' })).toBeTruthy()
  })

  it('confirms with the code the other side read out', async () => {
    mockGet.mockResolvedValue(accepted({ owner_code: '123456' }))
    mockPost.mockResolvedValue(accepted({ owner_code: '123456', owner_confirmed_at: '2026-08-30T02:00:00.000Z' }))
    await open()
    fireEvent.changeText(screen.getByLabelText('Enter their code'), '654321')
    fireEvent.press(screen.getByRole('button', { name: 'Confirm handoff' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/confirm', { code: '654321' })
    )
  })

  it('holds Confirm handoff until a code is typed', async () => {
    mockGet.mockResolvedValue(accepted({ owner_code: '123456' }))
    await open()
    expect(screen.getByRole('button', { name: 'Confirm handoff' }).props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByLabelText('Enter their code'), '654321')
    expect(
      screen.getByRole('button', { name: 'Confirm handoff' }).props.accessibilityState.disabled
    ).toBeFalsy()
  })

  it('shows the API\'s "Incorrect code" when the wrong code is entered', async () => {
    mockGet.mockResolvedValue(accepted({ owner_code: '123456' }))
    mockPost.mockRejectedValue(
      new Error('API POST /api/toy-transactions/tx1/confirm failed with status 400: Incorrect code')
    )
    await open()
    fireEvent.changeText(screen.getByLabelText('Enter their code'), '000000')
    fireEvent.press(screen.getByRole('button', { name: 'Confirm handoff' }))
    expect(await screen.findByText('Incorrect code')).toBeTruthy()
    // Still confirmable — a mistyped code is not a closed door.
    expect(screen.getByRole('button', { name: 'Confirm handoff' })).toBeTruthy()
  })

  it('replaces the code entry with a waiting line once the viewer has confirmed', async () => {
    mockGet.mockResolvedValue(accepted({ owner_code: '123456', owner_confirmed_at: '2026-08-30T02:00:00.000Z' }))
    await open()
    expect(screen.queryByRole('button', { name: 'Confirm handoff' })).toBeNull()
    expect(screen.queryByLabelText('Enter their code')).toBeNull()
    expect(screen.getByText('Waiting on the other side to confirm')).toBeTruthy()
  })
})

describe('ExchangeThreadScreen — accepted donation, one-way', () => {
  const donation = (over: object) =>
    detail({ type: 'donation', status: 'accepted', pickup_line1: '12 Rose St', pickup_suburb: 'Fitzroy', pickup_state: 'VIC', pickup_postcode: '3065', ...over })

  it('gives the owner the confirm control and no code of their own', async () => {
    mockGet.mockResolvedValue(donation({ owner_code: '123456', requester_code: null }))
    await open()
    expect(screen.getByRole('button', { name: 'Confirm handoff' })).toBeTruthy()
    expect(screen.queryByText(/Your handoff code/)).toBeNull()
  })

  it('gives the requester their code to read out and no confirm control', async () => {
    mockGet.mockResolvedValue(
      donation({ owner_id: 'owner1', requester_id: 'viewer1', owner_code: null, requester_code: '654321' })
    )
    await open()
    expect(screen.getByText(/Your handoff code/)).toBeTruthy()
    expect(screen.getByText('654321')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm handoff' })).toBeNull()
    expect(screen.queryByLabelText('Enter their code')).toBeNull()
  })
})

describe('ExchangeThreadScreen — settled transactions are read-only', () => {
  it.each(['completed', 'rejected', 'withdrawn'] as const)('shows no footer controls when %s', async (status) => {
    mockGet.mockResolvedValue(
      detail({ status, messages: [message({ kind: 'system', body: 'Handoff confirmed. This exchange is complete.' })] })
    )
    await open()
    expect(screen.getByText('Handoff confirmed. This exchange is complete.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirm handoff' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
  })

  it('hides the pickup block and the code once the handoff is complete', async () => {
    mockGet.mockResolvedValue(
      detail({ status: 'completed', owner_code: '123456', pickup_line1: '12 Rose St', pickup_suburb: 'Fitzroy' })
    )
    await open()
    expect(screen.queryByText(/Your handoff code/)).toBeNull()
    expect(screen.queryByText(/12 Rose St/)).toBeNull()
  })

  it('prompts the receiver to list a still-draft received toy, and navigates there', async () => {
    mockGet.mockResolvedValue(
      detail({
        status: 'completed',
        owner_id: 'owner1',
        requester_id: 'viewer1',
        received_toy: { id: 'received1', name: 'Switch car', status: 'draft' },
      })
    )
    await open()
    expect(screen.getByText('Handoff complete.')).toBeTruthy()
    expect(
      screen.getByText(
        'Switch car is yours now. Add it to the toy library if you would like others to be able to request it.'
      )
    ).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Add to toy library' }))
    expect(mockPush).toHaveBeenCalledWith('/toys/received1')
  })

  it('shows the plain settled state when there is no still-draft received toy', async () => {
    mockGet.mockResolvedValue(detail({ status: 'completed', received_toy: null }))
    await open()
    expect(screen.queryByText('Handoff complete.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add to toy library' })).toBeNull()
  })
})

describe('ExchangeThreadScreen — messages', () => {
  it('renders system, own and other messages', async () => {
    mockGet.mockResolvedValue(
      detail({
        messages: [
          message({ id: 'm1', kind: 'system', sender_id: 'requester1', body: 'Requested this toy for donation.' }),
          message({ id: 'm2', kind: 'user', sender_id: 'requester1', body: 'Is Saturday okay?' }),
          message({ id: 'm3', kind: 'user', sender_id: 'viewer1', body: 'Saturday works.' }),
        ],
      })
    )
    await open()
    expect(screen.getByText('Requested this toy for donation.')).toBeTruthy()
    expect(screen.getByText('Is Saturday okay?')).toBeTruthy()
    expect(screen.getByText('Saturday works.')).toBeTruthy()
    // The visual left/right split says nothing to a screen reader.
    expect(screen.getByLabelText('You said: Saturday works.')).toBeTruthy()
    expect(screen.getByLabelText('Jamie said: Is Saturday okay?')).toBeTruthy()
  })

  it('sends a message and appends the created one to the thread', async () => {
    mockPost.mockResolvedValue(message({ id: 'm9', sender_id: 'viewer1', body: 'On my way.' }))
    await open()
    fireEvent.changeText(screen.getByLabelText('Message Jamie'), 'On my way.')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/messages', { body: 'On my way.' })
    )
    expect(await screen.findByText('On my way.')).toBeTruthy()
  })

  it('holds Send until something is typed', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Send' }).props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByLabelText('Message Jamie'), 'Hi')
    expect(screen.getByRole('button', { name: 'Send' }).props.accessibilityState.disabled).toBeFalsy()
  })
})

describe('ExchangeThreadScreen — polling', () => {
  it('refetches every 10 seconds while focused and stops on blur', async () => {
    jest.useFakeTimers()
    try {
      const view = render(<ExchangeThreadScreen id="tx1" />)
      await act(async () => {})
      expect(mockGet).toHaveBeenCalledTimes(1)

      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(mockGet).toHaveBeenCalledTimes(2)

      view.unmount()
      await act(async () => {
        jest.advanceTimersByTime(30_000)
      })
      expect(mockGet).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('drops a poll that was already in flight when an action changed the row', async () => {
    jest.useFakeTimers()
    try {
      let landStalePoll: (value: unknown) => void = () => {}
      mockGet
        .mockResolvedValueOnce(detail({}))
        .mockReturnValueOnce(new Promise((resolve) => {
          landStalePoll = resolve
        }))
      mockPost.mockResolvedValue(detail({ status: 'rejected' }))
      render(<ExchangeThreadScreen id="tx1" />)
      await act(async () => {})

      // The poll goes out and stays out.
      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Decline' }))
      })
      expect(screen.getByText('REJECTED')).toBeTruthy()

      // It answers with the row as it was before the decline. Applying that
      // would put Accept/Decline back for the next ten seconds.
      await act(async () => {
        landStalePoll(detail({}))
      })
      expect(screen.getByText('REJECTED')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('does not let a poll wipe out the error the last action produced', async () => {
    jest.useFakeTimers()
    try {
      mockGet.mockResolvedValue(
        detail({ type: 'exchange', status: 'accepted', offered_toy_name: 'Fidget cube', owner_code: '123456' })
      )
      mockPost.mockRejectedValue(
        new Error('API POST /api/toy-transactions/tx1/confirm failed with status 400: Incorrect code')
      )
      render(<ExchangeThreadScreen id="tx1" />)
      await act(async () => {})
      fireEvent.changeText(screen.getByLabelText('Enter their code'), '000000')
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Confirm handoff' }))
      })
      expect(screen.getByText('Incorrect code')).toBeTruthy()

      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(screen.getByText('Incorrect code')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })
})
