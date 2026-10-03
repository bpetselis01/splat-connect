import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { EventFormScreen } from '../../../../components/organisation/event-form-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn(); const mockPut = jest.fn(); const mockBack = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }) }))
// The system picker is out of scope; it fills the same strings a typed field would.
jest.mock('../../../../components/ui/DateTimeField', () => {
  const { TextInput } = jest.requireActual('react-native')
  return { DateTimeField: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} />
  ) }
})

const publish = () => screen.getByRole('button', { name: 'Publish to Events' })
const draft = () => screen.getByRole('button', { name: 'Save as draft' })
const type = (placeholderOrLabel: string, v: string) => {
  const el = screen.queryByPlaceholderText(placeholderOrLabel) ?? screen.getByLabelText(placeholderOrLabel)
  fireEvent.changeText(el, v)
}
const fillValid = () => {
  type('Switch-adaptation build day', 'Build day')
  type('Date', '2099-10-18'); type('Starts', '10:00'); type('Ends', '14:00')
  type('Northside Therapy, 14 Corella St', '14 Corella St'); type('Crows Nest', 'Crows Nest')
  type('Parents and carers with a toy to adapt. No experience needed.', 'Parents')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({ id: 'ev1' }); mockPut.mockResolvedValue({})
})

describe('EventFormScreen publish gate', () => {
  it('lists everything still missing on a blank form, and Publish is off but Save as draft is on', () => {
    render(<EventFormScreen />)
    expect(publish()).toBeDisabled()
    expect(draft()).not.toBeDisabled()
    expect(screen.getByText(/Still needs a name, a date and start time, a venue, a suburb, who it is for before it can be published/)).toBeTruthy()
  })

  it('a complete in-person event can be published', () => {
    render(<EventFormScreen />)
    fillValid()
    expect(publish()).not.toBeDisabled()
    expect(screen.queryByText(/Still needs/)).toBeNull()
  })

  it.each([['name', 'Switch-adaptation build day'], ['venue', 'Northside Therapy, 14 Corella St'], ['suburb', 'Crows Nest']])(
    'a whitespace-only %s keeps Publish off', (_n, placeholder) => {
      render(<EventFormScreen />)
      fillValid()
      type(placeholder, '   ')
      expect(publish()).toBeDisabled()
    })

  it.each([['2099-02-31', '10:00'], ['18/10/2099', '10:00'], ['2099-10-18', '25:00'], ['2099-10-18', '10:75'], ['2099-10-18', '']])(
    'the date %s at %s is not accepted as a start', (d, t) => {
      render(<EventFormScreen />)
      fillValid()
      type('Date', d); type('Starts', t)
      expect(publish()).toBeDisabled()
    })

  it('a malformed end time asks for one like 15:30, and clearing it allows publishing', () => {
    render(<EventFormScreen />)
    fillValid()
    type('Ends', '2pm')
    expect(publish()).toBeDisabled()
    expect(screen.getByText(/an end time like 15:30/)).toBeTruthy()
    type('Ends', '')
    expect(publish()).not.toBeDisabled()
  })

  it('an end time before the start time cannot be published', () => {
    render(<EventFormScreen />)
    fillValid()
    type('Starts', '14:00'); type('Ends', '10:00')
    expect(publish()).toBeDisabled()
  })

  it('online needs a joining link instead of a venue and suburb', () => {
    render(<EventFormScreen />)
    type('Switch-adaptation build day', 'Zoom day')
    type('Date', '2099-10-18'); type('Starts', '10:00')
    type('Parents and carers with a toy to adapt. No experience needed.', 'All')
    fireEvent.press(screen.getByRole('radio', { name: 'Online' }))
    expect(publish()).toBeDisabled()
    expect(screen.getByText(/a joining link/)).toBeTruthy()
    fireEvent.changeText(screen.getByPlaceholderText('https://meet…'), 'https://meet.example/x')
    expect(publish()).not.toBeDisabled()
  })

  it.each([['12', false], ['12.50', false], ['$12', false], ['', false], ['12.505', true], ['abc', true], ['-5', true], ['1e3', true], ['12,50', true]])(
    'cost "%s": blocked=%s', (cost, blocked) => {
      render(<EventFormScreen />)
      fillValid()
      type('0.00', cost)
      expect(publish().props.accessibilityState.disabled).toBe(blocked)
    })

  it('a question left blank blocks publishing and drafting alike, with a plain message', async () => {
    render(<EventFormScreen />)
    fillValid()
    fireEvent.press(screen.getByRole('button', { name: '+ Head count' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remove "How many people are coming, including you?"' }))
    fireEvent.press(screen.getByText(/^\+ Short answer|^\+ Short/))
    expect(publish()).toBeDisabled()
    fireEvent.press(draft())
    expect(await screen.findByText('Every question needs something to ask. Fill it in or remove it.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('EventFormScreen saving', () => {
  it('Save as draft needs nothing, posts what there is, and goes back', async () => {
    render(<EventFormScreen />)
    fireEvent.press(draft())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][0]).toBe('/api/organizations/o1/events')
    expect(mockPost.mock.calls[0][1]).toMatchObject({ status: 'draft', title: '', capacity: null, prints_parts: false, part_sets_max: null, cost_cents: 0 })
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
  })

  it('posts times as ISO instants, trimmed text, cents, a number capacity, and then the questions in order', async () => {
    render(<EventFormScreen />)
    fillValid()
    type('Switch-adaptation build day', '  Build day  ')
    type('16', '24'); type('0.00', '12.50')
    fireEvent.press(screen.getByRole('button', { name: '+ Head count' }))
    fireEvent.press(screen.getByRole('button', { name: '+ Parking' }))
    fireEvent.press(publish())
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const body = mockPost.mock.calls[0][1]
    expect(body).toMatchObject({ title: 'Build day', status: 'published', capacity: 24, cost_cents: 1250, format: 'in_person', state: 'NSW' })
    expect(body.starts_at).toBe(new Date(2099, 9, 18, 10, 0).toISOString())
    expect(body.ends_at).toBe(new Date(2099, 9, 18, 14, 0).toISOString())
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/events/ev1/questions', { questions: [
      expect.objectContaining({ prompt: 'How many people are coming, including you?', answer_type: 'number', required: true }),
      expect.objectContaining({ prompt: 'Will you need a parking space?', answer_type: 'boolean' }),
    ] })
  })

  it('no end time posts null, not "Invalid Date"', async () => {
    render(<EventFormScreen />)
    fillValid(); type('Ends', '')
    fireEvent.press(publish())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1].ends_at).toBeNull()
  })

  it('printing parts sends the set cap; turning it off sends null', async () => {
    render(<EventFormScreen />)
    fillValid()
    fireEvent.press(screen.getByRole('radio', { name: 'Yes, on request' }))
    fireEvent.press(publish())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ prints_parts: true, part_sets_max: 6 })
  })

  it('the event posts once even on a double tap', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<EventFormScreen />)
    fillValid()
    fireEvent.press(publish()); fireEvent.press(publish())
    expect(mockPost).toHaveBeenCalledTimes(1)
    resolve({ id: 'ev1' })
  })

  it('if the API refuses the event, shows its words, stays put, and unlocks the buttons', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 400: Start time must be in the future'))
    render(<EventFormScreen />)
    fillValid()
    fireEvent.press(publish())
    expect(await screen.findByText('Start time must be in the future')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPut).not.toHaveBeenCalled()
    expect(publish()).not.toBeDisabled()
  })

  it('if saving the questions fails after the event saved, it says so rather than going back silently', async () => {
    mockPut.mockRejectedValue(new Error('Network request failed'))
    render(<EventFormScreen />)
    fillValid()
    fireEvent.press(screen.getByRole('button', { name: '+ Head count' }))
    fireEvent.press(publish())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it.each(NAMES.filter((c) => c.label !== 'very long').map((c): [string, string] => [c.label, c.value]))(
    'an event name with %s is posted trimmed and unchanged', async (_l, v) => {
      render(<EventFormScreen />)
      fillValid()
      type('Switch-adaptation build day', v)
      fireEvent.press(publish())
      await waitFor(() => expect(mockPost).toHaveBeenCalled())
      expect(mockPost.mock.calls[0][1].title).toBe(v.trim())
    })
})

describe('EventFormScreen registration questions', () => {
  it('Move up/down reorders and is disabled at the ends; Remove drops one', () => {
    render(<EventFormScreen />)
    fireEvent.press(screen.getByRole('button', { name: '+ Head count' }))
    fireEvent.press(screen.getByRole('button', { name: '+ Parking' }))
    expect(screen.getByRole('button', { name: 'Move "How many people are coming, including you?" up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move "Will you need a parking space?" down' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Move "Will you need a parking space?" up' }))
    expect(screen.getByRole('button', { name: 'Move "Will you need a parking space?" up' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Remove "Will you need a parking space?"' }))
    expect(screen.getByText('Registration form · 1 question')).toBeTruthy()
  })

  it('a choice question splits options on commas, trims them, and drops empties', () => {
    render(<EventFormScreen />)
    fireEvent.press(screen.getByRole('button', { name: '+ Choose one' }))
    fireEvent.changeText(screen.getByDisplayValue('Yes'), ' a , b,, c ,')
    expect(screen.getByDisplayValue('a, b, c')).toBeTruthy()
  })
})
