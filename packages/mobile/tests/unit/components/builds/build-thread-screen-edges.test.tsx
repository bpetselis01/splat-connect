// The build thread, from both sides and at every stage: who gets which button,
// what each button sends, the working shot, the handover code, and what each
// failure looks like.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { BuildThreadScreen } from '../../../../components/builds/build-thread-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
const mockPermission = jest.fn()
const mockLaunch = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermission(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a),
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
const mockSign = jest.fn()
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockSign(...a) }) } },
}))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockConfirm = jest.fn()
const mockNotify = jest.fn()
jest.mock('../../../../lib/confirm', () => ({
  confirmDestructive: (...a: unknown[]) => mockConfirm(...a),
  notify: (...a: unknown[]) => mockNotify(...a),
}))
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush, replace: mockReplace }) }
})
let mockViewer = 'fam'
let mockLed: Array<{ id: string }> = []
let mockProfile: Record<string, unknown> = {}
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: mockViewer, ...mockProfile }, ledOrgs: mockLed }, loading: false, refresh: jest.fn() }),
}))
// The panel has its own tests; here only which mode and title the thread asks for.
jest.mock('../../../../components/exchanges/cost-panel', () => ({
  CostPanel: ({ mode, title }: { mode: string; title: string }) => {
    const { Text } = jest.requireActual('react-native')
    return <Text>{`cost-panel:${mode}:${title}`}</Text>
  },
}))

const build = (over: object = {}) => ({
  id: 'b1',
  type: 'build',
  status: 'requested',
  toy_id: null,
  offered_toy_id: null,
  requester_id: 'fam',
  owner_id: null,
  owner_org_id: null,
  owner_code: '111111',
  requester_code: '222222',
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  pickup_line1: null,
  pickup_suburb: null,
  pickup_state: null,
  pickup_postcode: null,
  pickup_instructions: null,
  tutorial_id: 'g1',
  tutorial_title: 'Bubble machine',
  build_brief: null,
  travel_km: null,
  urgency: null,
 
  requester_suburb: 'Newtown',
  family_has_toy: false,
  working_photo_url: null,
  work_approved_at: null,
  owner_name: 'Tom Beattie',
  requester_name: 'Sam',
  toy_name: '',
  offered_toy_name: null,
  blocked_by_rival_accept: false,
  received_toy: null,
  messages: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
})
const claimed = (over: object = {}) => build({ owner_id: 'maker', ...over })
const live = (over: object = {}) => claimed({ status: 'accepted', ...over })
const shot = (over: object = {}) => live({ working_photo_url: 'b1/shot.jpg', ...over })
const approved = (over: object = {}) => shot({ work_approved_at: 'now', ...over })

// Runs the callback the confirm helper was handed, as a tap on Proceed would.
const proceed = () => act(async () => { await mockConfirm.mock.calls.at(-1)[3]() })

function serve(detail: object) {
  mockGet.mockImplementation((p: string) => (p === '/api/toy-transactions/b1' ? Promise.resolve(detail) : Promise.reject(new Error('n/a'))))
}
const as = (id: string, profile: Record<string, unknown> = {}, led: Array<{ id: string }> = []) => {
  mockViewer = id
  mockProfile = profile
  mockLed = led
}

beforeEach(() => {
  for (const m of [mockGet, mockPost, mockPush, mockReplace, mockPermission, mockLaunch, mockUpload, mockSign, mockConfirm, mockNotify]) m.mockReset()
  mockPost.mockResolvedValue({})
  mockSign.mockResolvedValue({ data: null })
  mockPermission.mockResolvedValue({ granted: true })
  as('fam')
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('loading', () => {
  it('says the build could not load, and Try again reads it once more', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network request failed'))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText("Couldn't load this build.")).toBeTruthy()
    serve(build())
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it('sends a toy opened at the build URL to the exchange thread, and shows nothing of it here', async () => {
    serve(build({ type: 'donation' }))
    render(<BuildThreadScreen id="b1" />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/exchanges/b1'))
    expect(screen.queryByText('Bubble machine')).toBeNull()
  })

  it('titles a build whose guide is gone "A build"', async () => {
    serve(build({ tutorial_title: null }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('A build')).toBeTruthy()
  })

  it.each(NAMES)('shows a guide titled with $label as typed', async ({ value }) => {
    serve(build({ tutorial_title: value }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText(value)).toBeTruthy()
  })
})

describe('the header line', () => {
  it.each([
    ['family, unclaimed', 'fam', build(), 'Build · waiting for a maker'],
    ['another maker, unclaimed', 'stranger', build(), 'Build for a family in Newtown'],
    ['another maker, unclaimed, no suburb', 'stranger', build({ requester_suburb: null }), 'Build for a family in your area'],
    ['maker, in progress', 'maker', live(), 'Build for Sam'],
    ['family, in progress', 'fam', live(), 'Build · Tom Beattie is making it'],
    ['maker, completed', 'maker', claimed({ status: 'completed' }), 'You built this for Sam'],
    ['family, completed', 'fam', claimed({ status: 'completed' }), 'Tom Beattie built this for you'],
    ['family, withdrawn', 'fam', claimed({ status: 'withdrawn' }), 'Nothing was built'],
    ['maker, declined', 'maker', claimed({ status: 'rejected' }), 'Nothing was built'],
  ])('reads %s', async (_l, viewer, detail, line) => {
    as(viewer)
    serve(detail)
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText(line)).toBeTruthy()
  })

  it('treats a leader of the maker organisation as the maker', async () => {
    as('leader', {}, [{ id: 'org' }])
    serve(live({ owner_id: null, owner_org_id: 'org' }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Build for Sam')).toBeTruthy()
    expect(screen.getByText('cost-panel:edit:Parts you bought for this build')).toBeTruthy()
  })
})

describe('an unclaimed request', () => {
  it('gives the family Asking first, which opens the questions, and no claim', async () => {
    serve(build())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Asking first'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/ask/b1')
    expect(screen.queryByText("I'll build this")).toBeNull()
  })

  it('gives another maker one tap to claim, and no Asking first', async () => {
    as('stranger')
    serve(build())
    mockPost.mockResolvedValue(claimed())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText("I'll build this"))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/claim', {}))
    expect(screen.queryByText('Asking first')).toBeNull()
  })

  it('shows the API’s sentence when the claim is refused, and the button stays usable', async () => {
    as('stranger')
    serve(build())
    mockPost.mockRejectedValue(new Error('failed with status 409: Someone else already claimed this.'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText("I'll build this"))
    expect(await screen.findByText('Someone else already claimed this.')).toBeTruthy()
    expect(screen.getByRole('button', { name: "I'll build this" })).toBeEnabled()
  })

  it('shows the generic apology when the claim fails with a server error', async () => {
    as('stranger')
    serve(build())
    mockPost.mockRejectedValue(new Error('failed with status 500: boom'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText("I'll build this"))
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()
  })

  it('claims once however many times the button is tapped while the claim is in flight', async () => {
    as('stranger')
    serve(build())
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText("I'll build this")
    fireEvent.press(screen.getByRole('button', { name: "I'll build this" }))
    fireEvent.press(screen.getByRole('button', { name: "I'll build this" }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(claimed()))
  })

  it('offers no message box, since nobody is on the other end yet', async () => {
    serve(build())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Asking first')
    expect(screen.queryByLabelText('Message')).toBeNull()
  })

  it('K12 lets the family withdraw an unclaimed request, saying "the request"', async () => {
    serve(build())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Withdraw the request'))
    expect(mockConfirm).toHaveBeenCalledWith('Withdraw this request?', expect.any(String), 'Proceed', expect.any(Function))
    expect(mockPost).not.toHaveBeenCalled()
    await proceed()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/withdraw', {}))
  })

  it('does nothing when the family cancels the confirmation', async () => {
    serve(build())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Withdraw the request'))
    // Cancel is the helper's default; Proceed's callback is simply never run.
    expect(mockConfirm.mock.calls[0]).toHaveLength(4)
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('K12 withdraws once on Proceed, then says the request was withdrawn', async () => {
    serve(build())
    mockPost.mockResolvedValue(build({ status: 'withdrawn' }))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Withdraw the request'))
    expect(mockNotify).not.toHaveBeenCalled()
    await proceed()
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Request withdrawn', expect.any(String)))
    expect(mockPost.mock.calls.filter(([url]) => url === '/api/toy-transactions/b1/withdraw')).toHaveLength(1)
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })

  it('shows the error and no success popup when the withdrawal fails', async () => {
    serve(build())
    mockPost.mockRejectedValue(new Error('boom'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Withdraw the request'))
    await proceed()
    await screen.findByText('Something went wrong. Please try again.')
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('shows no cost panel before a maker has the build', async () => {
    serve(build())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Asking first')
    expect(screen.queryByText(/^cost-panel/)).toBeNull()
  })
})

describe('a request addressed to a maker by name', () => {
  beforeEach(() => as('maker', { pickup_line1: '1 Rail St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }))

  it('asks a person for the pickup address first, seeded from their profile, and sends nothing yet', async () => {
    serve(claimed())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Street address').props.value).toBe('1 Rail St')
    expect(screen.getByLabelText('Postcode').props.value).toBe('2042')
  })

  it('starts the address fields empty when the profile has none, and keeps Take it on off until all four are filled', async () => {
    as('maker')
    serve(claimed())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    expect(screen.getByRole('button', { name: 'Take it on' })).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Street address'), '1 Rail St')
    fireEvent.changeText(screen.getByLabelText('Suburb'), 'Newtown')
    fireEvent.changeText(screen.getByLabelText('State'), 'NSW')
    fireEvent.changeText(screen.getByLabelText('Postcode'), '   ')
    expect(screen.getByRole('button', { name: 'Take it on' })).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Postcode'), '2042')
    expect(screen.getByRole('button', { name: 'Take it on' })).toBeEnabled()
  })

  it('K06 accepts with the address, and closes the form', async () => {
    serve(claimed())
    mockPost.mockResolvedValue(live())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    fireEvent.press(screen.getByRole('button', { name: 'Take it on' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/accept', {
        pickup_line1: '1 Rail St',
        pickup_suburb: 'Newtown',
        pickup_state: 'NSW',
        pickup_postcode: '2042',
      })
    )
    await waitFor(() => expect(screen.queryByLabelText('Street address')).toBeNull())
  })

  it('keeps the form and what was typed when accepting is refused', async () => {
    serve(claimed())
    mockPost.mockRejectedValue(new Error('failed with status 400: Postcode is four digits.'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    fireEvent.changeText(screen.getByLabelText('Street address'), "1 O'Rail <St> & Co")
    fireEvent.press(screen.getByRole('button', { name: 'Take it on' }))
    expect(await screen.findByText('Postcode is four digits.')).toBeTruthy()
    expect(screen.getByLabelText('Street address').props.value).toBe("1 O'Rail <St> & Co")
  })

  it('Cancel closes the form without sending, and brings Take it on and Decline back', async () => {
    serve(claimed())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    fireEvent.press(screen.getByText('Cancel'))
    expect(screen.queryByLabelText('Street address')).toBeNull()
    expect(screen.getByText('Decline')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('K07 declines with a reason, trimmed, and not before one is typed', async () => {
    serve(claimed())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Decline'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send the decline' })).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Reason for declining'), '  No time this month ')
    fireEvent.press(screen.getByRole('button', { name: 'Send the decline' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/reject', { reason: 'No time this month' }))
  })

  it('X15 K07 shows the family the maker’s reason on a declined build, and no reason line when there is none', async () => {
    as('fam')
    serve(claimed({ status: 'rejected', decline_reason: 'No time this month' }))
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Reason: No time this month')).toBeTruthy()
    unmount()
    serve(claimed({ status: 'rejected', decline_reason: null }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('This one did not go ahead')).toBeTruthy()
    expect(screen.queryByText(/^Reason:/)).toBeNull()
  })

  it('K06 accepts for an organisation with no address, which the server fixes', async () => {
    as('leader', {}, [{ id: 'org' }])
    serve(build({ owner_org_id: 'org' }))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Take it on'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/accept', {}))
    expect(screen.queryByLabelText('Street address')).toBeNull()
  })

  it('hides the withdraw button while the address form is open', async () => {
    serve(claimed())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Withdraw from this build')
    fireEvent.press(screen.getByText('Take it on'))
    expect(screen.queryByText('Withdraw from this build')).toBeNull()
  })
})

describe('the working shot', () => {
  beforeEach(() => as('maker'))

  it('does nothing when the picker is cancelled or answers with no asset', async () => {
    serve(live())
    mockLaunch.mockResolvedValueOnce({ canceled: true }).mockResolvedValueOnce({ canceled: false, assets: [] })
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Post the working shot'))
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByText('Post the working shot'))
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledTimes(2))
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('K08 uploads the picked photo with no id field, and defaults an unnamed photo to working-shot.jpg', async () => {
    serve(live())
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a' }] })
    mockUpload.mockResolvedValue(shot())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Post the working shot'))
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith(
        '/api/toy-transactions/b1/working-shot',
        'b1',
        { uri: 'file:///a', name: 'working-shot.jpg', mimeType: 'image/jpeg' },
        null
      )
    )
  })

  it.each([
    ['a 413 shows the API sentence', new Error('Upload to /x failed with status 413: Photo must be under 10 MB.'), 'Photo must be under 10 MB.'],
    ['a 415 shows the API sentence', new Error('Upload to /x failed with status 415: Unsupported photo type.'), 'Unsupported photo type.'],
    ['a 500 keeps the generic apology', new Error('Upload to /x failed with status 500'), 'Something went wrong. Please try again.'],
    ['offline says so', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('%s', async (_l, failure, message) => {
    serve(live())
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a' }] })
    mockUpload.mockRejectedValue(failure)
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Post the working shot'))
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('says Replace once a shot is posted, and offers it only to the maker and only until approval', async () => {
    serve(shot())
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Replace the working shot')).toBeTruthy()
    unmount()
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Handover')
    expect(screen.queryByText('Replace the working shot')).toBeNull()
    expect(screen.queryByText('Post the working shot')).toBeNull()
  })

  it('shows the family no post button, only the approval', async () => {
    as('fam')
    serve(shot())
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Looks right — arrange pickup')).toBeTruthy()
    expect(screen.queryByText('Post the working shot')).toBeNull()
    expect(screen.queryByText('Replace the working shot')).toBeNull()
  })

  it('shows the signed photo, with and without the approval line, and none when signing fails', async () => {
    mockSign.mockResolvedValue({ data: { signedUrl: 'https://x/shot.jpg' } })
    serve(shot())
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByLabelText('The working shot')).toBeTruthy()
    expect(screen.getByText('Working shot')).toBeTruthy()
    expect(mockSign).toHaveBeenCalledWith('b1/shot.jpg', 3600)
    unmount()
    serve(approved())
    const second = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Working shot · approved by the family')).toBeTruthy()
    second.unmount()
    mockSign.mockResolvedValue({ data: null, error: new Error('nope') })
    serve(shot())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Replace the working shot')
    expect(screen.queryByLabelText('The working shot')).toBeNull()
  })

  it('does not blow up when the signing request itself rejects', async () => {
    // An unhandled rejection from the component fails the test on its own.
    mockSign.mockRejectedValue(new Error('Network request failed'))
    serve(shot())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Replace the working shot')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByLabelText('The working shot')).toBeNull()
  })
})

describe('approval and the handover code', () => {
  it('K09 approves the shot', async () => {
    serve(shot())
    mockPost.mockResolvedValue(approved())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Looks right — arrange pickup'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/approve-work', {}))
  })

  it('K10 starts the family’s request for a change in the message box, without overwriting something already typed', async () => {
    serve(shot())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Ask for a change'))
    expect(screen.getByLabelText('Message').props.value).toBe('Could you change ')
    fireEvent.changeText(screen.getByLabelText('Message'), 'Could you change the colour')
    fireEvent.press(screen.getByText('Ask for a change'))
    expect(screen.getByLabelText('Message').props.value).toBe('Could you change the colour')
  })

  it('shows no code before the shot is approved, and each side its own code after', async () => {
    serve(shot())
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Looks right — arrange pickup')
    expect(screen.queryByText('Your handover code')).toBeNull()
    unmount()
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByLabelText('Handover code 2 2 2 2 2 2')).toBeTruthy()
  })

  it('shows the maker the maker’s code', async () => {
    as('maker')
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByLabelText('Handover code 1 1 1 1 1 1')).toBeTruthy()
  })

  it('shows the code box to nobody else', async () => {
    as('stranger')
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Handover')
    expect(screen.queryByText('Your handover code')).toBeNull()
  })

  it('K11 sends the code without the space an autofill or paste leaves on the end', async () => {
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Enter their code'), ' 111111 ')
    fireEvent.press(screen.getByText('Confirm handover'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/confirm', { code: '111111' }))
  })

  it.each(['', '   ', '\t\n'])('keeps Confirm off for %p', async (typed) => {
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Enter their code'), typed)
    expect(screen.getByRole('button', { name: 'Confirm handover' })).toBeDisabled()
    fireEvent.press(screen.getByText('Confirm handover'))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('keeps what was typed and shows the API’s sentence when the code is wrong', async () => {
    serve(approved())
    mockPost.mockRejectedValue(new Error('failed with status 400: Incorrect code'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Enter their code'), '000000')
    fireEvent.press(screen.getByText('Confirm handover'))
    expect(await screen.findByText('Incorrect code')).toBeTruthy()
    expect(screen.getByLabelText('Enter their code').props.value).toBe('000000')
  })

  it('stops asking for a code once this side has confirmed', async () => {
    serve(approved({ requester_confirmed_at: 'z' }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Your handover code')).toBeTruthy()
    expect(screen.queryByLabelText('Enter their code')).toBeNull()
    expect(screen.getByText('Waiting on Tom Beattie to confirm')).toBeTruthy()
  })

  it('confirms once however many times the button is tapped while it is in flight', async () => {
    serve(approved())
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Enter their code'), '111111')
    fireEvent.press(screen.getByRole('button', { name: 'Confirm handover' }))
    fireEvent.press(screen.getByRole('button', { name: 'Confirm handover' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(approved({ requester_confirmed_at: 'z' })))
  })
})

describe('the brief', () => {
  it('shows the family their own words as "You asked", and a maker "Family in <suburb>"', async () => {
    serve(claimed({ build_brief: 'For a child' }))
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText(/^You asked: /)).toBeTruthy()
    unmount()
    as('maker')
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText(/^Family in Newtown: /)).toBeTruthy()
  })

  it('joins the range and urgency that were given and skips the ones that were not', async () => {
    serve(claimed({ build_brief: 'x', travel_km: 25, urgency: 'This month' }))
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('Can travel 25 km · This month')).toBeTruthy()
    unmount()
    serve(claimed({ build_brief: 'x', travel_km: null, urgency: null }))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText(/^You asked: /)
    expect(screen.queryByText(/Can travel/)).toBeNull()
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('quotes a brief with $label as typed', async ({ value }) => {
    serve(claimed({ build_brief: value }))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText(/^You asked: /)
    expect(screen.getByText(new RegExp(`“${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}”`))).toBeTruthy()
  })

  it('shows no brief block when the request had none', async () => {
    serve(claimed({ build_brief: null }))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Build · Tom Beattie is making it')
    expect(screen.queryByText(/^You asked/)).toBeNull()
  })
})

describe('the thread and the cost panel', () => {
  const msg = (id: string, body: string, over: object = {}) => ({ id, sender_id: 'maker', body, kind: 'user', created_at: new Date().toISOString(), ...over })

  it('asks the maker for an itemised list and the family to settle, once a maker has it', async () => {
    as('maker')
    serve(live())
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('cost-panel:edit:Parts you bought for this build')).toBeTruthy()
    unmount()
    as('fam')
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText('cost-panel:settle:What this build costs you')).toBeTruthy()
  })

  it('keeps the cost panel after hand-over, and drops it for a build that did not go ahead', async () => {
    serve(claimed({ status: 'completed' }))
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByText(/^cost-panel:settle/)).toBeTruthy()
    unmount()
    serve(claimed({ status: 'withdrawn' }))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Nothing was built')
    expect(screen.queryByText(/^cost-panel/)).toBeNull()
  })

  it('shows no composer and no withdraw once the build is over', async () => {
    serve(claimed({ status: 'completed' }))
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Tom Beattie built this for you')
    expect(screen.queryByLabelText('Message')).toBeNull()
    expect(screen.queryByText('Withdraw the request')).toBeNull()
  })

  it('K12 offers the maker "Withdraw from this build"', async () => {
    as('maker')
    serve(live())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.press(await screen.findByText('Withdraw from this build'))
    await proceed()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/withdraw', {}))
  })

  it('keeps Send off for an empty or whitespace-only message', async () => {
    serve(live())
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), '  \n ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('K13 sends a message trimmed, shows it as the viewer’s own, and empties the box', async () => {
    serve(live())
    mockPost.mockResolvedValue(msg('m1', 'Friday?', { sender_id: 'fam' }))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), '  Friday?  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/messages', { body: 'Friday?' }))
    expect(await screen.findByLabelText('You said: Friday?')).toBeTruthy()
    expect(screen.getByLabelText('Message').props.value).toBe('')
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('K13 sends and shows a message with $label as typed', async ({ value }) => {
    serve(live())
    mockPost.mockResolvedValue(msg('m1', value, { sender_id: 'fam' }))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), value)
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/messages', { body: value }))
    expect(await screen.findByLabelText(`You said: ${value}`)).toBeTruthy()
  })

  it('keeps the draft and says why when sending fails, offline or refused', async () => {
    serve(live())
    mockPost.mockRejectedValueOnce(new Error('Network request failed')).mockRejectedValueOnce(new Error('failed with status 403: This build is closed.'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), 'hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByLabelText('Message').props.value).toBe('hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('This build is closed.')).toBeTruthy()
  })

  it('sends a 500 as the generic message apology', async () => {
    serve(live())
    mockPost.mockRejectedValue(new Error('failed with status 500: boom'))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), 'hi')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Could not send that message. Please try again.')).toBeTruthy()
  })

  it('sends one message however many times Send is tapped while it is in flight', async () => {
    serve(live())
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<BuildThreadScreen id="b1" />)
    fireEvent.changeText(await screen.findByLabelText('Message'), 'hello')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish(msg('m1', 'hello', { sender_id: 'fam' })))
  })

  it('names the other side on their messages and leaves system lines unattributed', async () => {
    serve(live({ messages: [msg('m1', 'On it'), msg('m2', 'Tom took this on.', { kind: 'system' })] }))
    render(<BuildThreadScreen id="b1" />)
    expect(await screen.findByLabelText('Tom Beattie said: On it')).toBeTruthy()
    expect(screen.getByText('Tom took this on.')).toBeTruthy()
  })

  it('offers the camera shortcut to the maker only until approval', async () => {
    as('maker')
    serve(live())
    const { unmount } = render(<BuildThreadScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.getAllByLabelText('Post the working shot').length).toBeGreaterThan(1)
    unmount()
    serve(approved())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByLabelText('Message')
    expect(screen.queryByLabelText('Post the working shot')).toBeNull()
  })
})

describe('polling', () => {
  it('re-reads the build every ten seconds and shows the change', async () => {
    jest.useFakeTimers()
    serve(live())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Build · Tom Beattie is making it')
    serve(approved())
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(await screen.findByText('Your handover code')).toBeTruthy()
  })

  it('keeps the build on screen with an error when a poll fails, and clears it once one works', async () => {
    jest.useFakeTimers()
    serve(live())
    render(<BuildThreadScreen id="b1" />)
    await screen.findByText('Build · Tom Beattie is making it')
    mockGet.mockRejectedValue(new Error('Network request failed'))
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    expect(await screen.findByText("Couldn't load this build.")).toBeTruthy()
    expect(screen.getByText('Build · Tom Beattie is making it')).toBeTruthy()
    serve(live())
    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    await waitFor(() => expect(screen.queryByText("Couldn't load this build.")).toBeNull())
  })
})
