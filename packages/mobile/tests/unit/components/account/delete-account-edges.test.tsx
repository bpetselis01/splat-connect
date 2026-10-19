// Account deletion at its edges: what the review screen says for empty and
// singular counts, what unlocks the code button, every way the code step can
// fail, and the Apple path.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { DeleteAccountScreen, openSummary } from '../../../../components/account/delete-account-screen'
import { problem } from '../../../../lib/auth-errors'

const mockBack = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }))
let mockAppleOn = false
jest.mock('../../../../lib/social-auth', () => ({
  appleAvailable: () => Promise.resolve(mockAppleOn),
  googleAvailable: () => false,
  AppleButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = require('react-native')
    return (
      <Pressable testID="native-apple" onPress={onPress}>
        <Text>apple</Text>
      </Pressable>
    )
  },
}))
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockAuth = {
  session: { user: { email: 'sam@example.com', app_metadata: { providers: ['email'] } } } as { user: { email?: string; app_metadata?: { providers: string[] } } },
  sendSignInCode: jest.fn(),
  verifyCode: jest.fn(),
  reauthWithApple: jest.fn(),
  signOut: jest.fn(),
}
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => mockAuth }))

const empty = { open: [], childProfiles: 0, publishedGuides: 0, soleLedOrgs: [] }
const ok = { problem: null }

function pending<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

async function reachCodeStep() {
  fireEvent.changeText(await screen.findByLabelText('Type DELETE to continue'), 'DELETE')
  fireEvent.press(screen.getByTestId('delete-send-code'))
  return screen.findByTestId('code-input')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAppleOn = false
  mockAuth.session = { user: { email: 'sam@example.com', app_metadata: { providers: ['email'] } } }
  mockGet.mockResolvedValue(empty)
  mockAuth.sendSignInCode.mockResolvedValue(ok)
  mockAuth.verifyCode.mockResolvedValue(ok)
  mockDelete.mockResolvedValue({})
})

describe('openSummary', () => {
  it.each([
    [[], ''],
    [[{ id: 'a', type: 'build' }], '1 build'],
    [[{ id: 'a', type: 'build' }, { id: 'b', type: 'build' }], '2 builds'],
    [[{ id: 'a', type: 'print' }, { id: 'b', type: 'print' }], '2 print jobs'],
    [[{ id: 'a', type: 'mystery' }], '1 request'],
    [[{ id: 'a', type: 'mystery' }, { id: 'b', type: 'other' }], '2 requests'],
    [[{ id: 'a', type: 'donation' }, { id: 'b', type: 'exchange' }], '2 exchanges'],
  ])('%j reads %j', (open, text) => {
    expect(openSummary(open)).toBe(text)
  })
})

describe('the review screen', () => {
  it('with nothing open, no children and no guides, lists only what always goes and what always stays', async () => {
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('Your profile, email and sign-in')).toBeTruthy()
    expect(screen.queryByText('Open right now')).toBeNull()
    expect(screen.queryByText(/child profile/)).toBeNull()
    expect(screen.queryByText(/published guide/)).toBeNull()
    expect(screen.queryByTestId('keep-name')).toBeNull()
    expect(screen.getByText("Other people's exchanges and messages with you")).toBeTruthy()
  })

  it('says "1 child profile" and "1 published guide" in the singular', async () => {
    mockGet.mockResolvedValue({ ...empty, childProfiles: 1, publishedGuides: 1 })
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('1 child profile')).toBeTruthy()
    expect(screen.getByText('1 published guide')).toBeTruthy()
  })

  it('a huge count is printed whole', async () => {
    mockGet.mockResolvedValue({ ...empty, childProfiles: 1000000, publishedGuides: 1234 })
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('1000000 child profiles')).toBeTruthy()
    expect(screen.getByText('1234 published guides')).toBeTruthy()
  })

  it('an unreadable preview says so and offers no way to delete', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('Could not load your account. Check your connection and try again.')).toBeTruthy()
    expect(screen.queryByTestId('delete-send-code')).toBeNull()
  })

  it('shows Loading… until the preview arrives', async () => {
    const slow = pending<typeof empty>()
    mockGet.mockReturnValue(slow.promise)
    render(<DeleteAccountScreen />)
    expect(screen.getByText('Loading…')).toBeTruthy()
    await act(async () => slow.resolve(empty))
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('names every sole-led organisation, markup and all, and blocks even with open items', async () => {
    mockGet.mockResolvedValue({
      ...empty,
      open: [{ id: 'x', type: 'build' }],
      soleLedOrgs: [{ id: '1', name: '<b>Northbank</b> & "Co"' }, { id: '2', name: 'Zoë 🧸' }],
    })
    render(<DeleteAccountScreen />)
    expect(await screen.findByText(/only leader of <b>Northbank<\/b> & "Co", Zoë 🧸/)).toBeTruthy()
    expect(screen.queryByTestId('delete-send-code')).toBeNull()
    expect(screen.queryByText('Open right now')).toBeNull()
  })

  it('warns about open exchanges and tells the person the other side is told', async () => {
    mockGet.mockResolvedValue({ ...empty, open: [{ id: 'a', type: 'exchange' }, { id: 'b', type: 'build' }, { id: 'c', type: 'build' }] })
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('1 exchange, 2 builds in progress')).toBeTruthy()
    expect(screen.getByText('These will be cancelled and the other person told.')).toBeTruthy()
  })
})

describe('unlocking the code button', () => {
  const button = () => screen.getByTestId('delete-send-code')
  const type = async (text: string) => fireEvent.changeText(await screen.findByLabelText('Type DELETE to continue'), text)

  it.each(['delete', 'Delete', 'DELET', 'DELETEE', 'DE LETE', 'DELETE!', '', '   ', 'ＤＥＬＥＴＥ'])('%j keeps it off', async (text) => {
    render(<DeleteAccountScreen />)
    await type(text)
    fireEvent.press(button())
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
  })

  it.each(['DELETE', '  DELETE  ', '\tDELETE\n'])('%j turns it on', async (text) => {
    render(<DeleteAccountScreen />)
    await type(text)
    fireEvent.press(button())
    await waitFor(() => expect(mockAuth.sendSignInCode).toHaveBeenCalledWith('sam@example.com'))
  })

  it('typing it and then deleting a letter turns it off again', async () => {
    render(<DeleteAccountScreen />)
    await type('DELETE')
    await type('DELET')
    fireEvent.press(button())
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
  })

  it('a code that cannot be sent stays on the review with the reason', async () => {
    mockAuth.sendSignInCode.mockResolvedValue({ problem: problem('rate-limited') })
    render(<DeleteAccountScreen />)
    await type('DELETE')
    fireEvent.press(button())
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
    expect(screen.queryByTestId('code-input')).toBeNull()
  })

  it('tapping the button twice while the code is being sent emails one code', async () => {
    const slow = pending<typeof ok>()
    mockAuth.sendSignInCode.mockReturnValue(slow.promise)
    render(<DeleteAccountScreen />)
    await type('DELETE')
    fireEvent.press(button())
    fireEvent.press(button())
    await act(async () => slow.resolve(ok))
    expect(mockAuth.sendSignInCode).toHaveBeenCalledTimes(1)
  })
})

describe('the code step', () => {
  const type = (text: string) => fireEvent.changeText(screen.getByTestId('code-input'), text)

  it.each(['1', '12345', 'abcdef', '12 34'])('%j is too short to delete anything', async (text) => {
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type(text)
    await act(async () => {})
    expect(mockAuth.verifyCode).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Z05 a pasted code with spaces and dashes is checked and deletes', async () => {
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123 456')
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
    expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'email')
  })

  it('Z05 keeps nothing from the account until the code is right: a wrong code deletes nothing and empties the boxes', async () => {
    mockAuth.verifyCode.mockResolvedValue({ problem: problem('bad-code') })
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('000000')
    expect(await screen.findByText(/That code didn't work/)).toBeTruthy()
    expect(screen.getByTestId('code-input').props.value).toBe('')
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Z05 a wrong code, then the right one, deletes once', async () => {
    mockAuth.verifyCode.mockResolvedValueOnce({ problem: problem('bad-code') }).mockResolvedValueOnce(ok)
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('000000')
    await screen.findByText(/That code didn't work/)
    type('123456')
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('Z05 offline while checking the code deletes nothing and says so', async () => {
    mockAuth.verifyCode.mockResolvedValue({ problem: problem('offline') })
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Z05 a deletion the server refuses keeps the account: an apology, no done screen, no sign-out', async () => {
    mockDelete.mockRejectedValue(new Error('500'))
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    expect(await screen.findByText('Your account was not deleted. Try again in a moment.')).toBeTruthy()
    expect(screen.queryByText('Your account is deleted')).toBeNull()
    expect(mockAuth.signOut).not.toHaveBeenCalled()
  })

  it('says Deleting… while the request is out', async () => {
    const slow = pending<{ emailed: boolean }>()
    mockDelete.mockReturnValue(slow.promise)
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    expect(await screen.findByText('Deleting…')).toBeTruthy()
    await act(async () => slow.resolve({ emailed: false }))
    expect(screen.getByText('Your account is deleted')).toBeTruthy()
  })

  it('Z05 sends confirm DELETE, no name kept by default and no Apple code', async () => {
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    await screen.findByText('Your account is deleted')
    expect(mockDelete).toHaveBeenCalledWith('/api/me', { confirm: 'DELETE', keepCredit: false, appleAuthorizationCode: undefined })
  })

  it('no confirmation email line when the server did not send one', async () => {
    mockDelete.mockResolvedValue({ emailed: false })
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    await screen.findByText('Your account is deleted')
    expect(screen.queryByText(/We emailed a confirmation/)).toBeNull()
  })

  it('Z05 an empty answer from the server (no body) is still a deletion', async () => {
    mockDelete.mockResolvedValue(undefined)
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    type('123456')
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
  })

  it('Keep my account leaves the screen without deleting', async () => {
    render(<DeleteAccountScreen />)
    await reachCodeStep()
    fireEvent.press(screen.getByText('Keep my account'))
    expect(mockBack).toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Z05 un-ticking Keep my name sends false', async () => {
    mockGet.mockResolvedValue({ ...empty, publishedGuides: 2 })
    render(<DeleteAccountScreen />)
    fireEvent.press(await screen.findByTestId('keep-name'))
    fireEvent.press(screen.getByTestId('keep-name'))
    await reachCodeStep()
    type('123456')
    await screen.findByText('Your account is deleted')
    expect(mockDelete).toHaveBeenCalledWith('/api/me', expect.objectContaining({ keepCredit: false }))
  })
})

describe('Apple accounts', () => {
  beforeEach(() => {
    mockAppleOn = true
    mockAuth.session = { user: { email: 'sam@privaterelay.appleid.com', app_metadata: { providers: ['apple'] } } }
  })
  const unlock = async () => fireEvent.changeText(await screen.findByLabelText('Type DELETE to continue'), 'DELETE')

  it('offers Apple\'s button only once DELETE is typed, and never to an email account', async () => {
    render(<DeleteAccountScreen />)
    await screen.findByLabelText('Type DELETE to continue')
    expect(screen.queryByTestId('native-apple')).toBeNull()
    await unlock()
    expect(await screen.findByTestId('native-apple')).toBeTruthy()
  })

  it('an email account does not get it even when Apple is switched on', async () => {
    mockAuth.session = { user: { email: 'sam@example.com', app_metadata: { providers: ['email'] } } }
    render(<DeleteAccountScreen />)
    await unlock()
    await act(async () => {})
    expect(screen.queryByTestId('native-apple')).toBeNull()
  })

  it('Z05 re-authorising hands the authorization code to the deletion', async () => {
    mockAuth.reauthWithApple.mockResolvedValue({ problem: null, authorizationCode: 'auth-code' })
    render(<DeleteAccountScreen />)
    await unlock()
    fireEvent.press(await screen.findByTestId('native-apple'))
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
    expect(mockDelete).toHaveBeenCalledWith('/api/me', { confirm: 'DELETE', keepCredit: false, appleAuthorizationCode: 'auth-code' })
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
  })

  it('closing Apple\'s sheet deletes nothing and shows nothing', async () => {
    mockAuth.reauthWithApple.mockResolvedValue({ problem: null, cancelled: true })
    render(<DeleteAccountScreen />)
    await unlock()
    fireEvent.press(await screen.findByTestId('native-apple'))
    await act(async () => {})
    expect(mockDelete).not.toHaveBeenCalled()
    expect(screen.queryByText(/not deleted|Couldn't/)).toBeNull()
  })

  it('a failed re-authorisation says so and deletes nothing', async () => {
    mockAuth.reauthWithApple.mockResolvedValue({ problem: { kind: 'other', message: "Couldn't sign in with Apple. Try again, or use your email." } })
    render(<DeleteAccountScreen />)
    await unlock()
    fireEvent.press(await screen.findByTestId('native-apple'))
    expect(await screen.findByText("Couldn't sign in with Apple. Try again, or use your email.")).toBeTruthy()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('after deletion', () => {
  it('Done signs out, and the page offers no way back to the review', async () => {
    mockDelete.mockResolvedValue({ emailed: true })
    render(<DeleteAccountScreen />)
    const code = await reachCodeStep()
    fireEvent.changeText(code, '123456')
    await screen.findByText('Your account is deleted')
    expect(screen.queryByText('Keep my account')).toBeNull()
    fireEvent.press(screen.getByTestId('deleted-done'))
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
  })

  it('tells the person where the confirmation went, with an address that has markup characters', async () => {
    mockAuth.session = { user: { email: "o'brien+<x>@example.com", app_metadata: { providers: ['email'] } } }
    mockDelete.mockResolvedValue({ emailed: true })
    render(<DeleteAccountScreen />)
    const code = await reachCodeStep()
    fireEvent.changeText(code, '123456')
    expect(await screen.findByText("We emailed a confirmation to o'brien+<x>@example.com.")).toBeTruthy()
  })
})
