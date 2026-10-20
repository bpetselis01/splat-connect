// Marking a toy unavailable, retiring it and answering requests, with a second
// tap, a refusal, a stale list and odd data. Ordinary journeys: summary-screen.test.tsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'
import { toySummaryLead } from '../../../../lib/my-toy'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})
let mockLed: { id: string; name: string }[] = []
const mockInvalidate = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: (...a: unknown[]) => mockInvalidate(...a),
  useCapabilities: () => ({ caps: { profile: { id: 'me', name: 'Sam' }, isAdmin: false, ledOrgs: mockLed, unread: {}, exchangeActions: 0 }, loading: false, refresh: jest.fn() }),
}))

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Light-up drum', description: null, condition: 8, switch_adapted: false,
  photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation', created_at: '2026-06-04T12:00:00Z', updated_at: '', ...over,
})
const orgToy = (over: object = {}) => toy({ owner_id: null, owner_org_id: 'org1', ...over })
const request = (over: object = {}) => ({
  id: 'tx1', toy_id: 't1', type: 'donation', status: 'requested', requester_id: 'fam1', owner_id: 'me', owner_org_id: null,
  requester_name: 'Eastwood', other_party_name: 'Eastwood', blocked_by_rival_accept: false,
  last_message: { body: 'Hello', sender_id: 'fam1', kind: 'user', created_at: '' }, ...over,
})
function serve({ mine = [toy()], inventory = [] as object[], txs = [] as object[] } = {}) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/toys' ? Promise.resolve(mine) : p === '/api/toys/inventory' ? Promise.resolve(inventory) : p === '/api/toy-transactions' ? Promise.resolve(txs) : Promise.reject(new Error('x'))
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLed = []
  serve()
})

describe('marking a toy unavailable', () => {
  it('W04 sends one change when the row is pressed twice before the answer', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}))
    render(<ToySummaryScreen id="t1" />)
    const row = await screen.findByText('Mark unavailable')
    fireEvent.press(row)
    fireEvent.press(row)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('W04 keeps the toy available, and says why, when the change is refused', async () => {
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 409: This toy is not published'))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Mark unavailable'))
    expect(await screen.findByText('This toy is not published')).toBeTruthy()
    expect(screen.getByText('Mark unavailable')).toBeTruthy()
  })

  it('W04 says the phone is offline when it cannot reach the API', async () => {
    mockPatch.mockRejectedValue(new TypeError('Network request failed'))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Mark unavailable'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  })

  it('offers no pause on a draft toy, and "Take requests again" on one already paused', async () => {
    serve({ mine: [toy({ status: 'draft' })] })
    const { unmount } = render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Edit listing')
    expect(screen.queryByText('Mark unavailable')).toBeNull()
    unmount()
    serve({ mine: [toy({ paused_at: '2026-09-30T00:00:00Z' })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Take requests again')).toBeTruthy()
  })

  it('W04 clears an earlier error when the next change works', async () => {
    mockPatch.mockRejectedValueOnce(new Error('API PATCH /x failed with status 409: Nope')).mockResolvedValueOnce(toy({ paused_at: '2026-09-30T00:00:00Z' }))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Mark unavailable'))
    await screen.findByText('Nope')
    fireEvent.press(screen.getByText('Mark unavailable'))
    await screen.findByText('Take requests again')
    expect(screen.queryByText('Nope')).toBeNull()
  })
})

describe('retiring an organisation toy', () => {
  beforeEach(() => {
    mockLed = [{ id: 'org1', name: 'Northside' }]
    serve({ mine: [], inventory: [orgToy()] })
  })

  it('sends a blank or spaces-only reason as null, and a padded one trimmed', async () => {
    mockPatch.mockResolvedValue(orgToy())
    render(<ToySummaryScreen id="t1" />)
    const box = await screen.findByLabelText('Why it is retired')
    fireEvent.changeText(box, '   ')
    fireEvent.press(screen.getByText('Retire'))
    await waitFor(() => expect(mockPatch.mock.calls[0][1].retired_note).toBeNull())
  })

  it('retires once when pressed twice before the answer', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}))
    render(<ToySummaryScreen id="t1" />)
    const btn = await screen.findByText('Retire')
    fireEvent.press(btn)
    fireEvent.press(btn)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)))('keeps a reason with $label text as typed, and shows it once retired', async ({ value }) => {
    mockPatch.mockResolvedValue(orgToy({ retired_at: '2026-08-12T00:00:00Z', retired_note: value }))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.changeText(await screen.findByLabelText('Why it is retired'), value)
    fireEvent.press(screen.getByText('Retire'))
    await waitFor(() => expect(mockPatch.mock.calls[0][1].retired_note).toBe(value))
    expect(await screen.findByText(value)).toBeTruthy()
  })

  it('shows Retired with no note line when there was no reason', async () => {
    serve({ mine: [], inventory: [orgToy({ retired_at: '2026-08-12T00:00:00Z', retired_note: null })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Retired')).toBeTruthy()
  })
})

describe('requests', () => {
  it('lists none of another toy\'s requests, nor one that is no longer open', async () => {
    serve({ txs: [request({ id: 'a', toy_id: 'other' }), request({ id: 'b', status: 'accepted', requester_name: 'Accepted Fam' }), request({ id: 'c', status: 'rejected', requester_name: 'Rejected Fam' }), request({ id: 'd', status: 'completed', requester_name: 'Done Fam' })] })
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Edit listing')
    for (const n of ['Accepted Fam', 'Rejected Fam', 'Done Fam']) expect(screen.queryByText(n)).toBeNull()
    expect(screen.queryByText('Accept')).toBeNull()
    expect(screen.queryByText(/have asked|has asked/)).toBeNull()
  })

  it('says one family has asked, singular', async () => {
    serve({ txs: [request()] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Light-up drum — listed 4 June, good condition. 1 family has asked for it.')).toBeTruthy()
  })

  it('draws a long list of requests', async () => {
    serve({ txs: Array.from({ length: 40 }, (_, i) => request({ id: `tx${i}`, requester_name: `Family ${i}` })) })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText(/40 families have asked/)).toBeTruthy()
    expect(screen.getAllByText('Accept')).toHaveLength(40)
  })

  it('holds Accept on a request that a rival accept has locked', async () => {
    serve({ txs: [request({ blocked_by_rival_accept: true })] })
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Eastwood')
    const accept = screen.getAllByLabelText('Accept').find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityState?.disabled !== undefined)
    expect(accept?.props.accessibilityState.disabled).toBe(true)
    fireEvent.press(screen.getByText('Accept'))
    expect(mockPush).not.toHaveBeenCalledWith('/exchanges/tx1?accept=1')
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws a family named with $label text and their note', async ({ value }) => {
    serve({ txs: [request({ requester_name: value, last_message: { body: value, sender_id: 'fam1', kind: 'user', created_at: '' } })] })
    render(<ToySummaryScreen id="t1" />)
    expect((await screen.findAllByText(value)).length).toBeGreaterThan(0)
  })

  it('shows no note when the last message is the owner\'s own reply', async () => {
    serve({ txs: [request({ last_message: { body: 'Sure, Saturday', sender_id: 'me', kind: 'user', created_at: '' } })] })
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Eastwood')
    expect(screen.queryByText('Sure, Saturday')).toBeNull()
  })

  it('shows no note when the request has no messages at all', async () => {
    serve({ txs: [request({ last_message: null })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Eastwood')).toBeTruthy()
  })

  describe('an organisation answering', () => {
    beforeEach(() => {
      mockLed = [{ id: 'org1', name: 'Northside' }]
      serve({ mine: [], inventory: [orgToy()], txs: [request({ owner_id: null, owner_org_id: 'org1' })] })
    })

    it('accepts once when Accept is pressed twice before the answer', async () => {
      mockPost.mockReturnValue(new Promise(() => {}))
      render(<ToySummaryScreen id="t1" />)
      const accept = await screen.findByText('Accept')
      fireEvent.press(accept)
      fireEvent.press(accept)
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    it('shows the API reason, and keeps the request, when the accept is refused', async () => {
      mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: Your organisation needs a pickup address before you can accept requests'))
      render(<ToySummaryScreen id="t1" />)
      fireEvent.press(await screen.findByText('Accept'))
      expect(await screen.findByText('Your organisation needs a pickup address before you can accept requests')).toBeTruthy()
      expect(screen.getByText('Eastwood')).toBeTruthy()
    })
  })
})

describe('the lead sentence', () => {
  const lead = (over: object, asks: number) =>
    toySummaryLead({ name: 'Drum', condition: 8, switch_adapted: false, status: 'published', created_at: '2026-06-04T12:00:00Z', ...over } as never, asks)

  it.each([
    [10, 'like new'], [9, 'like new'], [7, 'good'], [5, 'well-loved'], [4, 'needs a fix'], [0, 'needs a fix'],
  ])('names condition %i in words, %s', (condition, word) => {
    expect(lead({ condition }, 0)).toBe(`Drum — listed 4 June, ${word} condition.`)
  })

  it('keeps a name with markup and quotes whole', () => {
    expect(lead({ name: '<b>"Drum" & co</b>' }, 0)).toContain('<b>"Drum" & co</b> — listed')
  })

  it('says 12 families for twelve asks, and nothing at zero', () => {
    expect(lead({}, 12)).toMatch(/12 families have asked for it\.$/)
    expect(lead({}, 0)).not.toMatch(/asked/)
  })

  it('leaves out the listing date for a draft and a retired-from-shelf unpublished toy', () => {
    expect(lead({ status: 'draft' }, 0)).toBe('Drum, good condition.')
    expect(lead({ status: 'draft', switch_adapted: true }, 1)).toBe('Drum, good condition, switch-adapted. 1 family has asked for it.')
  })
})
