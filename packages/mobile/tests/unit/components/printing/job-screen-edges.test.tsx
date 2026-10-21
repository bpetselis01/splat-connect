// One print job, from both sides: every state's card, the handover code, the
// fit answer, the thread, the cost panel, and the ways each of those fails.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
const mockSign = jest.fn()
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockSign(...a) }) } },
}))
jest.mock('expo-image-picker', () => ({}))

const mockReady = jest.fn()
jest.mock('../../../../components/printing/actions', () => ({
  ...jest.requireActual('../../../../components/printing/actions'),
  markReady: (...a: unknown[]) => mockReady(...a),
}))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})
let mockViewer = 'family'
const mockInvalidate = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: (...a: unknown[]) => mockInvalidate(...a),
  useCapabilities: () => ({ caps: { profile: { id: mockViewer }, ledOrgs: [] } }),
}))

const DAY = 864e5
const job = (over: object = {}) => ({
  id: 'j1',
  type: 'print',
  status: 'requested',
  requester_id: 'family',
  owner_id: 'maker',
  owner_org_id: null,
  requester_name: 'Fran Family',
  owner_name: 'Tom B.',
  tutorial_title: 'Switch mount',
  printer_id: null,
  printer: null,
  print_files: [{ id: 's1', filename: 'mount.stl', quantity: 1 }],
  print_group_id: 'g',
  print_group_size: 1,
  printing_started_at: null,
  ready_at: null,
  ready_photo_url: null,
  owner_code: '111111',
  requester_code: '222222',
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  created_at: new Date().toISOString(),
  messages: [],
  ...over,
})
const accepted = (over: object = {}) => job({ status: 'accepted', ...over })
const printing = (over: object = {}) => accepted({ printing_started_at: 'x', ...over })
const ready = (over: object = {}) => printing({ ready_at: 'y', ...over })

function serve(detail: object, extra: Record<string, unknown> = {}) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1'
      ? Promise.resolve(detail)
      : path in extra
        ? Promise.resolve(extra[path])
        : Promise.reject(new Error('n/a'))
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset().mockResolvedValue({})
  mockReady.mockReset()
  mockPush.mockReset()
  mockSign.mockReset().mockResolvedValue({ data: null })
  mockViewer = 'family'
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('loading', () => {
  it('says the job could not load when the first read fails', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText("Couldn't load this print job.")).toBeTruthy()
  })

  it('titles a job whose guide is gone "A print job"', async () => {
    serve(job({ tutorial_title: null }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('A print job')).toBeTruthy()
  })

  it('counts parts by quantity, singular for one', async () => {
    serve(job({ print_files: [{ id: 'a', filename: 'a', quantity: 2 }, { id: 'b', filename: 'b', quantity: 3 }] }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^5 parts · asked today$/)).toBeTruthy()
    unmount()
    serve(job())
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^1 part · asked today$/)).toBeTruthy()
  })

  it('writes the day, not "today", for a job asked earlier', async () => {
    serve(job({ created_at: new Date(Date.now() - 3 * DAY).toISOString() }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^1 part · asked \d{1,2} \w{3,4}$/)).toBeTruthy()
  })
})

describe('polling', () => {
  it('re-reads the job every ten seconds, and shows what changed', async () => {
    jest.useFakeTimers()
    serve(job())
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByLabelText('Progress: Requested')).toBeTruthy()
    serve(accepted())
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(await screen.findByLabelText('Progress: Accepted')).toBeTruthy()
  })

  it('shows an error over the kept job when a poll fails, and clears it when the next one works', async () => {
    jest.useFakeTimers()
    serve(job())
    render(<PrintJobScreen id="j1" />)
    await screen.findByLabelText('Progress: Requested')
    mockGet.mockRejectedValue(new Error('Network request failed'))
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(await screen.findByText("Couldn't load this print job.")).toBeTruthy()
    expect(screen.getByLabelText('Progress: Requested')).toBeTruthy()
    serve(job())
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    await waitFor(() => expect(screen.queryByText("Couldn't load this print job.")).toBeNull())
  })

  it('does not let a poll that left before a write put the old state back', async () => {
    jest.useFakeTimers()
    serve(job())
    render(<PrintJobScreen id="j1" />)
    await screen.findByLabelText('Progress: Requested')
    // Every read from here hangs until released, so the order they land in is the test's to choose.
    const reads: Array<(v: object) => void> = []
    mockGet.mockImplementation(() => new Promise((r) => reads.push(r)))
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(reads).toHaveLength(1)
    fireEvent.press(screen.getByText('Withdraw request'))
    await waitFor(() => expect(reads).toHaveLength(2))
    // The reload after the write answers first with the new state; the poll that left earlier lands after it.
    await act(async () => reads[1]!(job({ status: 'withdrawn' })))
    await act(async () => reads[0]!(job()))
    expect(screen.getByLabelText('Progress: Withdrawn')).toBeTruthy()
  })
})

describe('the printer’s side', () => {
  beforeEach(() => {
    mockViewer = 'maker'
  })

  it('sends a requested job to Print for others to answer', async () => {
    serve(job())
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Answer in Print for others'))
    expect(mockPush).toHaveBeenCalledWith('/print-for-others')
    expect(screen.queryByText('Withdraw request')).toBeNull()
  })

  it('offers no way to withdraw, and no cost panel, to the printer', async () => {
    serve(accepted())
    render(<PrintJobScreen id="j1" />)
    await screen.findByText('Started printing')
    expect(screen.queryByText('Withdraw request')).toBeNull()
    expect(screen.queryByText('What this print costs you')).toBeNull()
  })

  it('marks it started, and moves the card on to the next move', async () => {
    serve(accepted())
    mockPost.mockResolvedValue(printing())
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Started printing'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/print-started', {}))
    expect(await screen.findByText('Mark ready for pickup')).toBeTruthy()
    expect(screen.getByLabelText('Progress: Printing')).toBeTruthy()
  })

  it('stays on Printing when the printer backs out of the photo picker', async () => {
    serve(printing())
    mockReady.mockResolvedValue(null)
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Mark ready for pickup'))
    await waitFor(() => expect(mockReady).toHaveBeenCalledWith('j1'))
    expect(screen.getByLabelText('Progress: Printing')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark ready for pickup' })).toBeEnabled()
  })

  it('shows the sentence when the photo library is refused', async () => {
    serve(printing())
    mockReady.mockRejectedValue(new Error('failed with status 400: Photo library access is needed to post the photo.'))
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Mark ready for pickup'))
    expect(await screen.findByText('Photo library access is needed to post the photo.')).toBeTruthy()
  })

  it('shows a generic apology when starting fails with a server error', async () => {
    serve(accepted())
    mockPost.mockRejectedValue(new Error('failed with status 500: pg exploded'))
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Started printing'))
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()
  })

  it('shows the customization the family chose, and nothing when they chose none', async () => {
    serve(accepted({ print_fit_notes: [{ label: 'Reach from seated', value: 'Under 20 cm' }, { label: 'Tray thickness', value: '10 mm' }] }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Reach from seated: Under 20 cm')).toBeTruthy()
    expect(screen.getByText('Tray thickness: 10 mm')).toBeTruthy()
    unmount()
    serve(accepted({ print_fit_notes: [] }))
    render(<PrintJobScreen id="j1" />)
    await screen.findByText('Started printing')
    expect(screen.queryByText('Customization')).toBeNull()
  })

  it('tells a printer who has the code already entered that it is waiting on the family', async () => {
    serve(ready({ owner_confirmed_at: 'z' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Waiting on Fran Family to confirm')).toBeTruthy()
    expect(screen.queryByLabelText('Their code')).toBeNull()
  })

  it('shows the printer their own code, not the family’s', async () => {
    serve(ready())
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('111111')).toBeTruthy()
    expect(screen.queryByText('222222')).toBeNull()
    expect(screen.getByText('Confirm handover')).toBeTruthy()
  })
})

describe('the handover code', () => {
  it('sends the code without the space an autofill or paste leaves on the end', async () => {
    serve(ready())
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Their code'), ' 111111 ')
    fireEvent.press(screen.getByText('I have collected it'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/confirm', { code: '111111' }))
  })

  it.each(['', '   ', '\t\n'])('keeps the confirm button off for %p and sends nothing', async (typed) => {
    serve(ready())
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Their code'), typed)
    expect(screen.getByRole('button', { name: 'I have collected it' })).toBeDisabled()
    fireEvent.press(screen.getByText('I have collected it'))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('keeps what was typed and shows the API’s sentence when the code is wrong', async () => {
    serve(ready())
    mockPost.mockRejectedValue(new Error('failed with status 400: Incorrect code'))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Their code'), '000000')
    fireEvent.press(screen.getByText('I have collected it'))
    expect(await screen.findByText('Incorrect code')).toBeTruthy()
    expect(screen.getByLabelText('Their code').props.value).toBe('000000')
  })

  it('clears the box and waits on the other side once the code is accepted', async () => {
    serve(ready())
    mockPost.mockResolvedValue(ready({ requester_confirmed_at: 'z' }))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Their code'), '111111')
    fireEvent.press(screen.getByText('I have collected it'))
    expect(await screen.findByText('Waiting on Tom B. to confirm')).toBeTruthy()
  })

  it('sends one confirm however many times the button is tapped while it is in flight', async () => {
    serve(ready())
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Their code'), '111111')
    fireEvent.press(screen.getByRole('button', { name: 'I have collected it' }))
    fireEvent.press(screen.getByRole('button', { name: 'I have collected it' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(ready({ requester_confirmed_at: 'z' })))
  })
})

describe('the ready card for the family', () => {
  it('says the printer is posting it, with no pickup address, when delivery is post', async () => {
    serve(ready({ print_delivery: 'post', pickup_suburb: 'Newtown' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^Tom B\. is posting it\./)).toBeTruthy()
    expect(screen.queryByText(/Newtown/)).toBeNull()
  })

  it('joins the pickup address that was filled in and skips the blanks', async () => {
    serve(ready({ pickup_line1: '1 Rail St', pickup_suburb: 'Newtown', pickup_state: null, pickup_postcode: '2042' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^1 Rail St, Newtown, 2042\. Settle the filament/)).toBeTruthy()
  })

  it('sends the family to the thread when no pickup address came with the job', async () => {
    serve(ready())
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(/^Agree where in the thread\./)).toBeTruthy()
  })

  it('shows the pickup instructions the printer left', async () => {
    serve(ready({ pickup_instructions: 'Blue gate <around the back> & ring twice' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Blue gate <around the back> & ring twice')).toBeTruthy()
  })

  it('shows the photo of the finished parts once the signed link comes back, and none if it fails', async () => {
    mockSign.mockResolvedValue({ data: { signedUrl: 'https://x/y.jpg' } })
    serve(ready({ ready_photo_url: 'j1/photo.jpg' }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByLabelText('Photo of the finished parts')).toBeTruthy()
    expect(mockSign).toHaveBeenCalledWith('j1/photo.jpg', 600)
    unmount()
    mockSign.mockRejectedValue(new Error('storage down'))
    render(<PrintJobScreen id="j1" />)
    await screen.findAllByText('Ready for pickup')
    expect(screen.queryByLabelText('Photo of the finished parts')).toBeNull()
  })
})

describe('did it fit', () => {
  const collected = (over: object = {}) => job({ status: 'completed', ...over })

  it('sends a reprint answer', async () => {
    serve(collected())
    mockPost.mockResolvedValue(collected({ print_fit: 'reprint' }))
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Needs a reprint'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/print-fit', { fit: 'reprint' }))
  })

  it('locks both buttons once an answer is in, so it cannot be changed or double-sent', async () => {
    serve(collected({ print_fit: 'fitted' }))
    render(<PrintJobScreen id="j1" />)
    await screen.findByText('Did it fit?')
    expect(screen.getByRole('button', { name: 'Fitted' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Needs a reprint' })).toBeDisabled()
  })

  it('does not ask the printer whether it fitted', async () => {
    mockViewer = 'maker'
    serve(collected())
    render(<PrintJobScreen id="j1" />)
    await screen.findAllByText('Collected')
    expect(screen.queryByText('Did it fit?')).toBeNull()
  })

  it('shows the API’s sentence when the answer is refused, and leaves both buttons usable', async () => {
    serve(collected())
    mockPost.mockRejectedValue(new Error('failed with status 409: Already answered.'))
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Fitted'))
    expect(await screen.findByText('Already answered.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fitted' })).toBeEnabled()
  })
})

describe('withdrawing', () => {
  it.each([
    ['requested', job()],
    ['accepted', accepted()],
  ])('is offered to the family on a %s job', async (_s, detail) => {
    serve(detail)
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Withdraw request')).toBeTruthy()
  })

  it.each([
    ['collected', job({ status: 'completed' })],
    ['declined', job({ status: 'rejected' })],
    ['withdrawn', job({ status: 'withdrawn' })],
  ])('is not offered on a %s job, nor is the composer', async (_s, detail) => {
    serve(detail)
    render(<PrintJobScreen id="j1" />)
    await screen.findByLabelText(/^Progress:/)
    expect(screen.queryByText('Withdraw request')).toBeNull()
    expect(screen.queryByLabelText('Message Tom B.')).toBeNull()
  })

  it('R06 withdraws, then reloads the job to show it withdrawn', async () => {
    serve(job())
    mockPost.mockResolvedValue({})
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Withdraw request'))
    serve(job({ status: 'withdrawn' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/withdraw', {}))
    expect(await screen.findByLabelText('Progress: Withdrawn')).toBeTruthy()
    expect(screen.getByText('This job was withdrawn')).toBeTruthy()
  })

  it('shows the API’s sentence and stays withdrawable when it is refused', async () => {
    serve(job())
    mockPost.mockRejectedValue(new Error('failed with status 409: Someone already took it.'))
    render(<PrintJobScreen id="j1" />)
    fireEvent.press(await screen.findByText('Withdraw request'))
    expect(await screen.findByText('Someone already took it.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeEnabled()
  })
})

describe('the thread', () => {
  const msg = (id: string, body: string, over: object = {}) => ({
    id,
    sender_id: 'maker',
    body,
    kind: 'user',
    created_at: new Date().toISOString(),
    ...over,
  })

  it('keeps Send off for an empty or whitespace-only message', async () => {
    serve(accepted())
    render(<PrintJobScreen id="j1" />)
    const box = await screen.findByLabelText('Message Tom B.')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.changeText(box, '   \n ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('R05 sends the message trimmed, shows it, and empties the box', async () => {
    serve(accepted())
    mockPost.mockResolvedValue(msg('m1', 'Is Friday ok?', { sender_id: 'family' }))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Message Tom B.'), '  Is Friday ok?  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/messages', { body: 'Is Friday ok?' }))
    expect(await screen.findByLabelText('You said: Is Friday ok?')).toBeTruthy()
    expect(screen.getByLabelText('Message Tom B.').props.value).toBe('')
  })

  it('keeps the draft and shows the reason when sending fails, and sends once on retry', async () => {
    serve(accepted())
    mockPost.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(msg('m1', 'hi', { sender_id: 'family' }))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Message Tom B.'), 'hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByLabelText('Message Tom B.').props.value).toBe('hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
    expect(await screen.findByLabelText('You said: hi')).toBeTruthy()
  })

  it('sends one message however many times Send is tapped while it is in flight', async () => {
    serve(accepted())
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Message Tom B.'), 'hello')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(msg('m1', 'hello', { sender_id: 'family' })))
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('sends and shows a message with $label exactly as typed', async ({ value }) => {
    serve(accepted())
    mockPost.mockResolvedValue(msg('m1', value, { sender_id: 'family' }))
    render(<PrintJobScreen id="j1" />)
    fireEvent.changeText(await screen.findByLabelText('Message Tom B.'), value)
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/messages', { body: value }))
    expect(await screen.findByLabelText(`You said: ${value}`)).toBeTruthy()
  })

  it('names the sender on theirs and shows system lines unattributed', async () => {
    serve(accepted({ messages: [msg('m1', 'Printing tonight'), msg('m2', 'Tom accepted this request.', { kind: 'system' })] }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByLabelText('Tom B. said: Printing tonight')).toBeTruthy()
    expect(screen.getByText('Tom accepted this request.')).toBeTruthy()
  })

  it('does not call the viewer’s own system line "mine"', async () => {
    serve(accepted({ messages: [msg('m1', 'System note', { kind: 'system', sender_id: 'family' })] }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('System note')).toBeTruthy()
    expect(screen.queryByLabelText(/You said: System note/)).toBeNull()
  })
})

describe('the cost panel', () => {
  const printer = (over: object = {}) => ({ id: 'p1', filament_cents_per_g: null, rate_note: null, ...over })
  const withPrinter = (detail: object, p: object, costs?: object) =>
    serve({ ...detail, printer_id: 'p1' }, { '/api/printers/p1': p, ...(costs ? { '/api/exchange-costs/j1': costs } : {}) })

  it('says Free · parts only when the printer declared no rate, or the printer read failed', async () => {
    withPrinter(accepted(), printer())
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Free · parts only')).toBeTruthy()
    unmount()
    serve(accepted({ printer_id: 'p1' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Free · parts only')).toBeTruthy()
  })

  it.each([
    [12, '$0.12'],
    [5, '$0.05'],
    [100, '$1.00'],
    [0, '$0.00'],
  ])('writes a rate of %i cents a gram as %s', async (cents, text) => {
    withPrinter(accepted(), printer({ filament_cents_per_g: cents }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText(`About ${text} / g of filament, settled between you`)).toBeTruthy()
  })

  it('quotes the printer’s note as typed, including angle brackets and quotes', async () => {
    withPrinter(accepted(), printer({ rate_note: 'Spool "PolyLite" <cost> & time free' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('“Spool "PolyLite" <cost> & time free”')).toBeTruthy()
  })

  it('shows the amount owed only when there is one', async () => {
    withPrinter(accepted(), printer(), { total_cents: 1250 })
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('$12.50')).toBeTruthy()
    expect(screen.getByText('You pay back')).toBeTruthy()
    unmount()
    withPrinter(accepted(), printer(), { total_cents: 0 })
    render(<PrintJobScreen id="j1" />)
    await screen.findByText('Free · parts only')
    expect(screen.queryByText('You pay back')).toBeNull()
  })

  it('hides the panel on a job that did not go ahead', async () => {
    for (const detail of [job({ status: 'rejected' }), job({ status: 'withdrawn' }), job({ created_at: new Date(Date.now() - 9 * DAY).toISOString() })]) {
      serve(detail)
      const { unmount } = render(<PrintJobScreen id="j1" />)
      await screen.findByLabelText(/^Progress:/)
      expect(screen.queryByText('What this print costs you')).toBeNull()
      unmount()
    }
  })

  it('shows the credit line once accepted, not while still requested, and not when none was applied', async () => {
    serve(job({ print_credit_grams: 40 }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    await screen.findByText('What this print costs you')
    expect(screen.queryByText(/Your recycling credit/)).toBeNull()
    unmount()
    serve(accepted({ print_credit_grams: 40 }))
    const second = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Your recycling credit (40 g)')).toBeTruthy()
    second.unmount()
    serve(accepted({ print_credit_grams: null }))
    render(<PrintJobScreen id="j1" />)
    await screen.findByText('What this print costs you')
    expect(screen.queryByText(/Your recycling credit/)).toBeNull()
  })
})

describe('end states', () => {
  it('says a declined job could not be taken, with no reason when none was given', async () => {
    serve(job({ status: 'rejected', decline_reason: null }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Tom B. could not take it')).toBeTruthy()
    expect(screen.getByText('Nothing was printed. Another printer may be able to take it.')).toBeTruthy()
  })

  it('shows a decline reason with markup characters as plain text', async () => {
    serve(job({ status: 'rejected', decline_reason: '<b>No</b> PETG & "no time"' }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('<b>No</b> PETG & "no time" — another printer may be able to.')).toBeTruthy()
  })

  it('names the group size when several printers were asked, and falls back to one', async () => {
    serve(job({ print_group_size: 3 }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Asked 3 printers.')).toBeTruthy()
    unmount()
    serve(job({ print_group_size: null }))
    render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('Asked 1 printer.')).toBeTruthy()
  })

  it('names the machine once a printer has it, and not before', async () => {
    serve(accepted({ printer: { name: 'Bambu P1S' } }))
    const { unmount } = render(<PrintJobScreen id="j1" />)
    expect(await screen.findByText('On Bambu P1S')).toBeTruthy()
    unmount()
    serve(accepted({ printer: null }))
    render(<PrintJobScreen id="j1" />)
    await screen.findByText(/They have taken it on/)
    expect(screen.queryByText(/^On /)).toBeNull()
  })
})
