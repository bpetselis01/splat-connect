import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { EventDetailScreen } from '../../../../components/events/event-detail-screen'
import { setReturnTo } from '../../../../lib/return-to'
import { event } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/return-to', () => ({ setReturnTo: jest.fn() }))
const mockUseAuth = jest.fn()
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }))
const mockProfile = { name: 'Priya Nair', email: 'priya@example.com' }
let mockCaps: { profile: typeof mockProfile } | null = { profile: mockProfile }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

const signedIn = { session: { user: { id: 'u1' } } }
const serve = (over: Record<string, unknown> = {}) => mockGet.mockResolvedValue(event(over))

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAuth.mockReturnValue(signedIn)
  mockCaps = { profile: mockProfile }
  mockPost.mockResolvedValue({})
  mockDelete.mockResolvedValue({})
  serve()
})

describe('EventDetailScreen', () => {
  it('V10 an open event shows the seat count, the going count and I\'m going', async () => {
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('Switch-adapted toy build day')).toBeTruthy()
    expect(screen.getByText('4 seats left')).toBeTruthy()
    expect(screen.getByText('16 of 20 seats taken')).toBeTruthy()
    expect(screen.getByText('16 going')).toBeTruthy()
    expect(screen.getByRole('button', { name: "I'm going" })).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/events/e1?viewer=u1')
  })

  it('a guest reads the event without a viewer id', async () => {
    mockUseAuth.mockReturnValue({ session: null })
    render(<EventDetailScreen id="e1" />)
    await screen.findByText('4 seats left')
    expect(mockGet).toHaveBeenCalledWith('/api/public/events/e1')
  })

  it('V12 a guest\'s I\'m going remembers the event and goes to sign-in', async () => {
    mockUseAuth.mockReturnValue({ session: null })
    mockCaps = null
    render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'm going" }))
    expect(setReturnTo).toHaveBeenCalledWith('/events/e1')
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('V11 an event with no questions and no cost posts the registration directly, then reloads', async () => {
    render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'm going" }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/events/e1/registrations', { name: 'Priya Nair', email: 'priya@example.com', answers: {} }),
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })

  it.each([
    ['has questions', { questions: [{ id: 'q', prompt: 'x', answer_type: 'short', required: true, options: [] }] }],
    ['has a cost', { cost_cents: 1200 }],
  ])('V12 an event that %s opens the register screen instead of posting', async (_l, over) => {
    serve(over)
    render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'm going" }))
    expect(mockPush).toHaveBeenCalledWith('/events/e1/register')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('V10 shows the cost and its breakdown, or says free', async () => {
    serve({ cost_cents: 1200, cost_note: 'Filament and morning tea.' })
    const { unmount } = render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('$12.00 towards materials')).toBeTruthy()
    expect(screen.getByText('Filament and morning tea.')).toBeTruthy()
    unmount()
    serve()
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('Free to attend')).toBeTruthy()
  })

  it('V10 a full event says so and offers no I\'m going', async () => {
    serve({ seats_left: 0, going_count: 20 })
    render(<EventDetailScreen id="e1" />)
    expect((await screen.findAllByText('This one is full')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: "I'm going" })).toBeNull()
  })

  it('V10 a closed event says the host closed it and offers no I\'m going', async () => {
    serve({ registrations_closed_at: '2099-01-01T00:00:00Z' })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('The host has closed registrations for this one.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I'm going" })).toBeNull()
  })

  it('V10 a cancelled event says so and has no footer', async () => {
    serve({ cancelled_at: '2099-01-01T00:00:00Z' })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('Cancelled by the host')).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I'm going" })).toBeNull()
  })

  it('V10 a past event says it has happened and has no footer', async () => {
    serve({ starts_at: '2020-01-01T00:00:00Z', ends_at: '2020-01-01T04:00:00Z' })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('This one has already happened.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I'm going" })).toBeNull()
  })

  it('a 404 says no such event', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('No such event.')).toBeTruthy()
  })

  it('V13 someone already going sees Can\'t make it, which deletes the registration', async () => {
    serve({ viewer_going: true })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText("You're going")).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I'm going" })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: "Can't make it" }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/events/e1/registrations'))
  })

  it('a full event the viewer is already going to still offers Can\'t make it', async () => {
    serve({ viewer_going: true, seats_left: 0 })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByRole('button', { name: "Can't make it" })).toBeTruthy()
  })

  it('shows the server\'s sentence when the registration is refused', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 409: This one is full. The host may open more seats.'))
    render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'm going" }))
    expect(await screen.findByText('This one is full. The host may open more seats.')).toBeTruthy()
  })

  it('V14 the host row opens the organisation page', async () => {
    render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: /Hosted by Northside Makers/ }))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisation/o1')
  })

  it('V15 Print parts here shows only when the event prints parts and the viewer is signed in', async () => {
    serve({ prints_parts: true, part_sets_max: 4 })
    const { unmount } = render(<EventDetailScreen id="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Print parts here' }))
    expect(mockPush).toHaveBeenCalledWith('/events/e1/print')
    unmount()

    serve()
    render(<EventDetailScreen id="e1" />)
    await screen.findByText('4 seats left')
    expect(screen.queryByRole('button', { name: 'Print parts here' })).toBeNull()
  })

  it('an event with no capacity says everyone is welcome and draws no seat count', async () => {
    serve({ capacity: null, seats_left: null })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('Everyone is welcome')).toBeTruthy()
    expect(screen.queryByText(/seats taken/)).toBeNull()
  })

  it('an online event never shows a joining link', async () => {
    serve({ format: 'online', location: null, online_url: null })
    render(<EventDetailScreen id="e1" />)
    expect(await screen.findByText('The joining link is sent to you once you say you are coming.')).toBeTruthy()
  })
})
