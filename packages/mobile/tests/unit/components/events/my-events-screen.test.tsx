import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { MyEventsScreen } from '../../../../components/events/my-events-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

const row = (over: { id?: string; reg?: string; event?: object; part?: object | null } = {}) => ({
  registration_id: over.reg ?? 'r1',
  event: {
    id: over.id ?? 'e1', org_name: 'Northside', title: 'Build day', starts_at: '2099-05-04T10:00:00Z', ends_at: '2099-05-04T14:00:00Z',
    format: 'in_person', suburb: 'Fitzroy', state: 'VIC', cancelled_at: null, ...over.event,
  },
  part_request: over.part ?? null,
})
const serve = (rows: unknown) => mockGet.mockResolvedValue(rows)

beforeEach(() => {
  jest.clearAllMocks()
  mockDelete.mockResolvedValue(null)
  serve([])
})

describe('MyEventsScreen', () => {
  it('says nothing is booked when there are no registrations', async () => {
    render(<MyEventsScreen />)
    expect(await screen.findByText('Nothing booked yet')).toBeTruthy()
  })

  it('a failed load says so and retries, instead of claiming nothing is booked', async () => {
    mockGet.mockRejectedValueOnce(new Error('offline'))
    render(<MyEventsScreen />)
    expect(await screen.findByText('Could not load your events.')).toBeTruthy()
    expect(screen.queryByText('Nothing booked yet')).toBeNull()
    serve([row()])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Build day')).toBeTruthy()
    expect(screen.queryByText('Could not load your events.')).toBeNull()
  })

  it('splits upcoming from been-and-gone, upcoming first, and offers Can\'t make it only on upcoming', async () => {
    serve([
      row({ id: 'old', reg: 'r0', event: { title: 'Last year', starts_at: '2020-01-01T10:00:00Z', ends_at: '2020-01-01T12:00:00Z' } }),
      row({ id: 'new' }),
    ])
    render(<MyEventsScreen />)
    expect(await screen.findByText('Build day')).toBeTruthy()
    expect(screen.getByText('Been and gone')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: "Can't make it" })).toHaveLength(1)
  })

  it('no "Been and gone" heading when nothing is past', async () => {
    serve([row()])
    render(<MyEventsScreen />)
    await screen.findByText('Build day')
    expect(screen.queryByText('Been and gone')).toBeNull()
  })

  it('Can\'t make it deletes that event\'s registration and reloads the list', async () => {
    serve([row({ id: 'e9' })])
    render(<MyEventsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: "Can't make it" }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/events/e9/registrations'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })

  it('a failed Can\'t make it says so, keeps the row, and can be retried', async () => {
    serve([row()])
    mockDelete.mockRejectedValueOnce(new Error('offline'))
    render(<MyEventsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: "Can't make it" }))
    expect(await screen.findByText('That did not save. Try once more.')).toBeTruthy()
    expect(screen.getByText('Build day')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: "Can't make it" }))
    await waitFor(() => expect(screen.queryByText('That did not save. Try once more.')).toBeNull())
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })

  it('a cancelled event shows Cancelled and offers no leave button', async () => {
    serve([row({ event: { cancelled_at: '2099-01-01T00:00:00Z' } })])
    render(<MyEventsScreen />)
    expect(await screen.findByText('Cancelled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: "Can't make it" })).toBeNull()
  })

  it('an online event says Online instead of a place', async () => {
    serve([row({ event: { format: 'online', suburb: null, state: null } })])
    render(<MyEventsScreen />)
    expect(await screen.findByText(/Northside · Online · /)).toBeTruthy()
  })

  it.each([
    ['suburb only', { suburb: 'Fitzroy', state: null }, /Northside · Fitzroy · /],
    ['state only', { suburb: null, state: 'VIC' }, /Northside · VIC · /],
    ['neither', { suburb: null, state: null }, /^Northside · \d/],
  ])('place line with %s has no stray comma', async (_l, ev, re) => {
    serve([row({ event: ev })])
    render(<MyEventsScreen />)
    const node = await screen.findByText(re)
    expect(node.props.children).not.toMatch(/, ·|·  ·|undefined|null/)
  })

  describe('print request on the registration', () => {
    it('accepted reads Printing', async () => {
      serve([row({ part: { status: 'accepted', decline_reason: null } })])
      render(<MyEventsScreen />)
      expect(await screen.findByText('Printing')).toBeTruthy()
      expect(screen.getByText(/Northside is printing your parts/)).toBeTruthy()
    })
    it('requested reads Parts pending', async () => {
      serve([row({ part: { status: 'requested', decline_reason: null } })])
      render(<MyEventsScreen />)
      expect(await screen.findByText('Parts pending')).toBeTruthy()
    })
    it('declined says why and offers Pick a printer, which goes to Printing', async () => {
      serve([row({ part: { status: 'rejected', decline_reason: 'Out of filament' } })])
      render(<MyEventsScreen />)
      expect(await screen.findByText('Parts declined')).toBeTruthy()
      expect(screen.getByText(/cannot print your parts — Out of filament/)).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Pick a printer' }))
      expect(mockPush).toHaveBeenCalledWith('/printing')
    })
    it('declined with no reason does not print a dangling dash', async () => {
      serve([row({ part: { status: 'rejected', decline_reason: null } })])
      render(<MyEventsScreen />)
      const t = await screen.findByText(/cannot print your parts/)
      expect(t.props.children.join ? t.props.children.join('') : t.props.children).not.toMatch(/—\s*$/)
    })
    it('a past event whose parts were declined still offers a printer but not a leave button', async () => {
      serve([row({ event: { starts_at: '2020-01-01T10:00:00Z', ends_at: null }, part: { status: 'rejected', decline_reason: null } })])
      render(<MyEventsScreen />)
      expect(await screen.findByRole('button', { name: 'Pick a printer' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: "Can't make it" })).toBeNull()
    })
  })

  it('titles with quotes, angle brackets, emoji and RTL render as plain text', async () => {
    const title = '<b>"Build" & play</b> 🧸 سارة'
    serve([row({ event: { title } })])
    render(<MyEventsScreen />)
    expect(await screen.findByText(title)).toBeTruthy()
  })

  it('50 registrations render without trouble', async () => {
    serve(Array.from({ length: 50 }, (_, i) => row({ id: `e${i}`, reg: `r${i}`, event: { title: `Event ${i}` } })))
    render(<MyEventsScreen />)
    expect(await screen.findByText('Event 49')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: "Can't make it" })).toHaveLength(50)
  })

  it('a double tap on Can\'t make it for two different events leaves each deleted once', async () => {
    serve([row({ id: 'a', reg: 'ra', event: { title: 'A' } }), row({ id: 'b', reg: 'rb', event: { title: 'B' } })])
    render(<MyEventsScreen />)
    const [first, second] = await screen.findAllByRole('button', { name: "Can't make it" })
    fireEvent.press(first); fireEvent.press(second)
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(2))
    expect(mockDelete.mock.calls.map((c) => c[0]).sort()).toEqual(['/api/events/a/registrations', '/api/events/b/registrations'])
  })
})
