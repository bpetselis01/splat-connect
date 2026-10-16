import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { EventRegistrationsScreen } from '../../../../components/organisation/event-registrations-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
const mockCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: jest.fn() }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps }))

const event = { id: 'e1', org_id: 'o1', kind: 'build_day', title: 'Build day', starts_at: '2026-11-01T01:00:00Z', capacity: 20, prints_parts: true, part_sets_max: 6 }
const part = { id: 't1', event_id: 'e1', status: 'requested', requester_name: 'Priya N.', tutorial_title: 'Ladybug', part_sets: 2, print_note: null, decline_reason: null }
const serve = (over: Record<string, unknown> = {}) =>
  mockGet.mockImplementation((p: string) => {
    const r: Record<string, unknown> = {
      '/api/organizations/o1/events': [event],
      '/api/organizations/o1/events/e1/questions': [{ id: 'q1', prompt: 'Any allergies?' }],
      '/api/organizations/o1/events/e1/registrations': [{ id: 'g1', name: 'Sam Lee', created_at: '2026-10-10T00:00:00Z', answers: { q1: 'Peanuts' } }],
      '/api/toy-transactions?role=owner': [part],
      ...over,
    }
    const v = r[p]
    return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  })
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockPost.mockResolvedValue({})
  serve()
})


describe('EventRegistrationsScreen', () => {
  it('shows each registrant answers by question label and says CSV is web-only', async () => {
    render(<EventRegistrationsScreen eventId="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: /Sam Lee/ }))
    expect(screen.getByText('Any allergies?')).toBeTruthy()
    expect(screen.getByText('Peanuts')).toBeTruthy()
    expect(screen.getByText(/Export to CSV is on the web dashboard/)).toBeTruthy()
  })

  it('shows an EmptyState when nobody has registered', async () => {
    serve({ '/api/organizations/o1/events/e1/registrations': [] })
    render(<EventRegistrationsScreen eventId="e1" />)
    expect(await screen.findByText('Nobody has registered yet.')).toBeTruthy()
  })

  it('accepts a part request', async () => {
    render(<EventRegistrationsScreen eventId="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "We'll print these for Priya N." }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/t1/accept', {}))
  })

  it('declines with the reason the family will see', async () => {
    render(<EventRegistrationsScreen eventId="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "Can't print these for Priya N." }))
    fireEvent.changeText(screen.getByLabelText('Why can you not print these?'), '  Printer is down.  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send decline to Priya N.' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/t1/reject', { reason: 'Printer is down.' }))
  })
})
