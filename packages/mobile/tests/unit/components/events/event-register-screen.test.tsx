// journeys: V01 V02
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { EventRegisterScreen } from '../../../../components/events/event-register-screen'
import { event, question } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { name: 'Priya Nair', email: 'priya@example.com' } } }),
}))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ replace: mockReplace }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

const QUESTIONS = [
  question({ id: 'qc', prompt: 'Which session suits you?', answer_type: 'choice', required: true, options: ['Morning', 'Afternoon'] }),
  question({ id: 'qb', prompt: 'Have you soldered before?', answer_type: 'boolean', required: false, options: [] }),
  question({ id: 'qs', prompt: 'What toy are you bringing?', answer_type: 'short', required: true, options: [] }),
  question({ id: 'qp', prompt: 'Anything we should know?', answer_type: 'paragraph', required: false, options: [] }),
  question({ id: 'qn', prompt: 'How many people?', answer_type: 'number', required: true, options: [] }),
]
const serve = (over: Record<string, unknown> = {}) => mockGet.mockResolvedValue(event(over))
const confirm = () => screen.getByRole('button', { name: 'Confirm my spot' })

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
})

describe('EventRegisterScreen', () => {
  it('prefills name and email from the profile and restates the event', async () => {
    serve()
    render(<EventRegisterScreen id="e1" />)
    expect(await screen.findByDisplayValue('Priya Nair')).toBeTruthy()
    expect(screen.getByDisplayValue('priya@example.com')).toBeTruthy()
    expect(screen.getByText('Switch-adapted toy build day')).toBeTruthy()
    expect(screen.getByText('Northside Makers asks nothing else. Your name and email are enough.')).toBeTruthy()
  })

  it('draws a control for every question type and submits the right answers shape', async () => {
    serve({ questions: QUESTIONS })
    render(<EventRegisterScreen id="e1" />)
    await screen.findByText('Questions from Northside Makers')
    expect(screen.getAllByText('Required')).toHaveLength(3)

    fireEvent.press(screen.getByRole('radio', { name: 'Morning' }))
    fireEvent.press(screen.getByRole('radio', { name: 'No' }))
    fireEvent.changeText(screen.getByLabelText('What toy are you bringing?'), 'Light-up penguin')
    fireEvent.changeText(screen.getByLabelText('Anything we should know?'), 'Quiet corner please')
    fireEvent.changeText(screen.getByLabelText('How many people?'), '3')
    fireEvent.press(confirm())

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/events/e1/registrations', {
        name: 'Priya Nair',
        email: 'priya@example.com',
        answers: { qc: 'Morning', qb: false, qs: 'Light-up penguin', qp: 'Quiet corner please', qn: '3' },
      }),
    )
    expect(mockReplace).toHaveBeenCalledWith('/events')
  })

  it('a blank required question blocks confirm and says how many are left', async () => {
    serve({ questions: QUESTIONS })
    render(<EventRegisterScreen id="e1" />)
    await screen.findByText('Questions from Northside Makers')
    expect(screen.getByText('3 required questions still to answer.')).toBeTruthy()
    fireEvent.press(confirm())
    expect(mockPost).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('radio', { name: 'Morning' }))
    expect(screen.getByText('2 required questions still to answer.')).toBeTruthy()
  })

  it('a whitespace-only required answer still counts as blank', async () => {
    serve({ questions: [QUESTIONS[2]] })
    render(<EventRegisterScreen id="e1" />)
    fireEvent.changeText(await screen.findByLabelText('What toy are you bringing?'), '   ')
    expect(screen.getByText('1 required question still to answer.')).toBeTruthy()
  })

  it('a costed event needs the cost box ticked and sends the acknowledgement', async () => {
    serve({ cost_cents: 1200, cost_note: 'Filament and morning tea.' })
    render(<EventRegisterScreen id="e1" />)
    const box = await screen.findByRole('checkbox', { name: 'I know this costs $12.00' })
    expect(screen.getByText('Filament and morning tea.')).toBeTruthy()
    fireEvent.press(confirm())
    expect(mockPost).not.toHaveBeenCalled()
    fireEvent.press(box)
    fireEvent.press(confirm())
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/events/e1/registrations', expect.objectContaining({ cost_acknowledged: true })),
    )
  })

  it('a free event has no cost box and sends no acknowledgement', async () => {
    serve()
    render(<EventRegisterScreen id="e1" />)
    await screen.findByDisplayValue('Priya Nair')
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.press(confirm())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('cost_acknowledged')
  })

  it('shows the server\'s full sentence inline and stays on the form', async () => {
    serve()
    mockPost.mockRejectedValue(new Error('Request failed with status 409: This one is full. The host may open more seats.'))
    render(<EventRegisterScreen id="e1" />)
    await screen.findByDisplayValue('Priya Nair')
    fireEvent.press(confirm())
    expect(await screen.findByText('This one is full. The host may open more seats.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows the server\'s 400 sentence word for word', async () => {
    serve()
    mockPost.mockRejectedValue(new Error('Request failed with status 400: That email address does not look right.'))
    render(<EventRegisterScreen id="e1" />)
    await screen.findByDisplayValue('Priya Nair')
    fireEvent.press(confirm())
    expect(await screen.findByText('That email address does not look right.')).toBeTruthy()
  })

  it('a closed event offers no form', async () => {
    serve({ registrations_closed_at: '2099-01-01T00:00:00Z' })
    render(<EventRegisterScreen id="e1" />)
    expect(await screen.findByText('You cannot register for this one.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm my spot' })).toBeNull()
  })

  it('a 404 says no such event', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    render(<EventRegisterScreen id="e1" />)
    expect(await screen.findByText('No such event.')).toBeTruthy()
  })
})
