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


describe('EventRegistrationsScreen failures', () => {
  it('a failed accept shows the server sentence and keeps the request open', async () => {
    mockPost.mockRejectedValue(new Error('POST failed with status 409: Already answered.'))
    render(<EventRegistrationsScreen eventId="e1" />)
    fireEvent.press(await screen.findByRole('button', { name: "We'll print these for Priya N." }))
    expect(await screen.findByText('Already answered.')).toBeTruthy()
    expect(screen.getByRole('button', { name: "We'll print these for Priya N." })).toBeTruthy()
  })

  it('a 403 shows the leaders only state', async () => {
    serve({ '/api/organizations/o1/events/e1/registrations': Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 }) })
    render(<EventRegistrationsScreen eventId="e1" />)
    expect(await screen.findByText('Leaders only')).toBeTruthy()
  })

  it('offline: says so and Try again loads it', async () => {
    serve({ '/api/organizations/o1/events': new TypeError('Network request failed') })
    render(<EventRegistrationsScreen eventId="e1" />)
    expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
    serve()
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Build day')).toBeTruthy()
  })

  it('says so when the event is gone', async () => {
    serve({ '/api/organizations/o1/events': [] })
    render(<EventRegistrationsScreen eventId="e1" />)
    expect(await screen.findByText("That event isn't here any more.")).toBeTruthy()
  })
})
