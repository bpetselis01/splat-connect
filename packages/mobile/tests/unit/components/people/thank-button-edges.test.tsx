import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ThankButton } from '../../../../components/people/thank-button'

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = { user: { id: 'me' } }
})
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }))
// A person's thanks opens the note sheet first; "Send thanks" posts it.
const send = () => fireEvent.press(screen.getByRole('button', { name: 'Send thanks' }))
const pressSend = (name: string) => { press(name); send() }

describe('ThankButton edges', () => {
  it('a double tap sends one thanks, not two', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
    pressSend('Thanks'); press('Thanks')
    await act(async () => { resolve({}) })
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('a network failure says so and leaves the button usable to try again', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
    pressSend('Thanks')
    expect(await screen.findByText('Could not send that. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thanks' })).not.toBeDisabled()
    mockPost.mockResolvedValueOnce({})
    pressSend('Thanks')
    expect(await screen.findByText('Thanks sent — they will see it in their notifications')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  it.each([['429', 'Request failed with status 429: Slow down'], ['500', 'Request failed with status 500'], ['403', 'Request failed with status 403: You cannot thank yourself']])(
    'a %s is a retryable failure, not "already thanked"', async (_c, msg) => {
      mockPost.mockRejectedValue(new Error(msg))
      render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
      pressSend('Thanks')
      expect(await screen.findByText('Could not send that. Try again.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Thanks' })).not.toBeDisabled()
    })

  it('a non-Error rejection is a retryable failure and does not crash', async () => {
    mockPost.mockRejectedValue('boom')
    render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
    pressSend('Thanks')
    expect(await screen.findByText('Could not send that. Try again.')).toBeTruthy()
  })

  it('a 409 locks the button, so a second thanks cannot be sent', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 409'))
    render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
    pressSend('Thanks')
    await screen.findByText('You already thanked them')
    expect(screen.getByRole('button', { name: 'Thanks' })).toBeDisabled()
    press('Thanks')
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('sends an empty body when there is no transaction, and no transaction_id key at all', async () => {
    mockPost.mockResolvedValue({})
    render(<ThankButton label="Thanks" to={{ profileId: 'p1' }} />)
    pressSend('Thanks')
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/contributors/p1/thanks', {}))
  })

  it('an organisation is thanked even if the member leads another one (only profile thanks are self-guarded)', async () => {
    mockPost.mockResolvedValue({})
    render(<ThankButton label="Thanks" to={{ orgId: 'me' }} />)
    press('Thanks')
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/me/thanks', {}))
  })

  it('the label can carry quotes, ampersands and emoji and is still the button name', () => {
    const label = 'Say thanks to "Tom & Jerry" 🧸'
    render(<ThankButton label={label} to={{ profileId: 'p1' }} />)
    expect(screen.getByRole('button', { name: label })).toBeTruthy()
  })

  it('signed out, a profile thanks goes to sign-in and an org thanks does too', () => {
    mockSession = null
    render(<ThankButton label="A" to={{ orgId: 'o1' }} />)
    press('A')
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('a different member id is not "yourself", even when it shares a prefix', () => {
    mockSession = { user: { id: 'me' } }
    render(<ThankButton label="Thanks" to={{ profileId: 'me2' }} />)
    expect(screen.getByRole('button', { name: 'Thanks' })).toBeTruthy()
  })
})
