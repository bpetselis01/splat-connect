import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DeleteAccountScreen, openSummary } from '../../../../components/account/delete-account-screen'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }))
jest.mock('../../../../lib/social-auth', () => ({
  appleAvailable: () => Promise.resolve(false),
  googleAvailable: () => false,
  AppleButton: () => null,
}))
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockAuth = {
  session: { user: { email: 'sam@example.com', app_metadata: { providers: ['email'] } } },
  sendSignInCode: jest.fn(),
  verifyCode: jest.fn(),
  reauthWithApple: jest.fn(),
  signOut: jest.fn(),
}
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => mockAuth }))

const preview = {
  open: [{ id: 't1', type: 'donation' }, { id: 't2', type: 'print' }],
  childProfiles: 2,
  publishedGuides: 3,
  soleLedOrgs: [],
}

beforeEach(() => jest.clearAllMocks())

describe('openSummary', () => {
  it('counts each kind in words', () => {
    expect(openSummary([{ id: 'a', type: 'exchange' }, { id: 'b', type: 'donation' }, { id: 'c', type: 'print' }])).toBe(
      '2 exchanges, 1 print job'
    )
  })
})

describe('DeleteAccountScreen', () => {
  it('lists what will happen and keeps the code button off until DELETE is typed', async () => {
    mockGet.mockResolvedValue(preview)
    render(<DeleteAccountScreen />)
    expect(await screen.findByText('1 exchange, 1 print job in progress')).toBeTruthy()
    expect(screen.getByText('2 child profiles')).toBeTruthy()
    expect(screen.getByText('3 published guides')).toBeTruthy()
    fireEvent.press(screen.getByTestId('delete-send-code'))
    expect(mockAuth.sendSignInCode).not.toHaveBeenCalled()
  })

  it('deletes after the sixth digit, carrying the keep-name choice', async () => {
    mockGet.mockResolvedValue(preview)
    mockAuth.sendSignInCode.mockResolvedValue({ problem: null })
    mockAuth.verifyCode.mockResolvedValue({ problem: null })
    mockDelete.mockResolvedValue(undefined)
    render(<DeleteAccountScreen />)
    fireEvent.press(await screen.findByTestId('keep-name'))
    fireEvent.changeText(screen.getByLabelText('Type DELETE to continue'), 'DELETE')
    fireEvent.press(screen.getByTestId('delete-send-code'))
    fireEvent.changeText(await screen.findByTestId('code-input'), '123456')
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
    expect(mockAuth.verifyCode).toHaveBeenCalledWith('sam@example.com', '123456', 'email')
    expect(mockDelete).toHaveBeenCalledWith('/api/me', { confirm: 'DELETE', keepCredit: true, appleAuthorizationCode: undefined })
    fireEvent.press(screen.getByTestId('deleted-done'))
    expect(mockAuth.signOut).toHaveBeenCalled()
  })

  it('stops a sole organisation leader before anything else', async () => {
    mockGet.mockResolvedValue({ ...preview, soleLedOrgs: [{ id: 'o', name: 'Northbank Toy Library' }] })
    render(<DeleteAccountScreen />)
    expect(await screen.findByText(/only leader of Northbank Toy Library/)).toBeTruthy()
    expect(screen.queryByTestId('delete-send-code')).toBeNull()
  })

  it('keeps the account and says so when the code is wrong', async () => {
    mockGet.mockResolvedValue(preview)
    mockAuth.sendSignInCode.mockResolvedValue({ problem: null })
    mockAuth.verifyCode.mockResolvedValue({ problem: { kind: 'bad-code', message: "That code didn't work." } })
    render(<DeleteAccountScreen />)
    fireEvent.changeText(await screen.findByLabelText('Type DELETE to continue'), 'DELETE')
    fireEvent.press(screen.getByTestId('delete-send-code'))
    fireEvent.changeText(await screen.findByTestId('code-input'), '000000')
    expect(await screen.findByText("That code didn't work.")).toBeTruthy()
    await waitFor(() => expect(mockDelete).not.toHaveBeenCalled())
  })
})
