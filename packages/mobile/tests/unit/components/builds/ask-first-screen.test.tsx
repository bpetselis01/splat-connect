import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AskFirstScreen } from '../../../../components/builds/ask-first-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
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

const questions = (over: object = {}) => ({
  transaction_id: 'b1', tutorial_title: 'Bubble machine', requester_suburb: 'Newtown', open: true, family: false,
  threads: [{ maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'm1', body: 'Which switch?', created_at: '2026-09-30T00:00:00Z' }] }],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.mockReturnValue(as('m1'))
  mockGet.mockResolvedValue(questions())
  mockPost.mockResolvedValue({})
})

describe('AskFirstScreen', () => {
  it('shows the board’s stage card and lets the maker ask', async () => {
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByText('Not claimed yet')).toBeTruthy()
    expect(screen.getByText('Ask about the parts or the switch. Claiming is one tap when you are ready.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Message'), 'Any batteries?')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Any batteries?' }))
  })

  it('claims in one tap and goes to the build thread', async () => {
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/exchanges/build/b1'))
  })

  it('lets the family pick which maker to answer, and offers them no claim', async () => {
    mockCaps.mockReturnValue(as('fam'))
    mockGet.mockResolvedValue(
      questions({
        family: true,
        threads: [
          { maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'm1', body: 'Which switch?', created_at: '2026-09-30T00:00:00Z' }] },
          { maker_id: 'm2', maker_name: 'Rachel', messages: [{ id: 'q2', sender_id: 'm2', body: 'Have the toy?', created_at: '2026-09-30T01:00:00Z' }] },
        ],
      })
    )
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Rachel' }))
    expect(screen.getByLabelText('Rachel said: Have the toy?')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Message'), 'Yes')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Yes', maker_id: 'm2' }))
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })
})
