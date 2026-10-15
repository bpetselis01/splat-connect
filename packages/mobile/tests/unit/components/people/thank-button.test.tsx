// journeys: P04 S02 X13
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ThankButton } from '../../../../components/people/thank-button'

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockSession: object | null = { user: { id: 'me' } }
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = { user: { id: 'me' } }
})

describe('ThankButton', () => {
  it('thanks a person, tied to the exchange, and says so', async () => {
    mockPost.mockResolvedValue({ thanks_count: 1 })
    render(<ThankButton label="Say thanks to Sam" to={{ profileId: 'p1' }} transactionId="tx1" />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks to Sam' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send thanks' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/contributors/p1/thanks', { transaction_id: 'tx1' }))
    expect(await screen.findByText('Thanks sent — they will see it in their notifications')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Say thanks to Sam' })).toBeDisabled()
  })

  it('sends the typed note, trimmed, and says only they will see it', async () => {
    mockPost.mockResolvedValue({ thanks_count: 1 })
    render(<ThankButton label="Say thanks" to={{ profileId: 'p1' }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks' }))
    expect(screen.getByText('Only they will see this.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Thank-you note'), '  You fixed our switch.  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send thanks' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/contributors/p1/thanks', { note: 'You fixed our switch.' }))
  })

  it('thanks an organisation through its own route, with no transaction', async () => {
    mockPost.mockResolvedValue({ thanks_count: 3 })
    render(<ThankButton label="Say thanks to Northside" to={{ orgId: 'o1' }} transactionId="tx1" />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks to Northside' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/thanks', {}))
  })

  it('says you already did on a 409', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 409: You already thanked them'))
    render(<ThankButton label="Say thanks" to={{ profileId: 'p1' }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send thanks' }))
    expect(await screen.findByText('You already thanked them')).toBeTruthy()
  })

  it('draws nothing on your own showcase — nobody thanks themselves', () => {
    render(<ThankButton label="Say thanks" to={{ profileId: 'me' }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sends a signed-out person to sign in instead', () => {
    mockSession = null
    render(<ThankButton label="Say thanks" to={{ profileId: 'p1' }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks' }))
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    expect(mockPost).not.toHaveBeenCalled()
  })
})
