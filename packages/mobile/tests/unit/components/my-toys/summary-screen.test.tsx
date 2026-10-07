// journeys: W03 W05
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const caps = (ledOrgs: { id: string; name: string }[] = []) => ({
  caps: {
    profile: { id: 'me', name: 'Sam', role: 'contributor' },
    isAdmin: false,
    ledOrgs,
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Light-up drum', description: null, condition: 8,
  switch_adapted: true, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '2026-06-04T12:00:00Z', updated_at: '', ...over,
})

const request = (over: object = {}) => ({
  id: 'tx1', toy_id: 't1', type: 'donation', status: 'requested', requester_id: 'fam1', owner_id: 'me', owner_org_id: null,
  requester_name: 'Eastwood Special School', other_party_name: 'Eastwood Special School', blocked_by_rival_accept: false,
  last_message: { body: 'For a class of four who share one switch', sender_id: 'fam1', kind: 'user', created_at: '' },
  ...over,
})

/** Routes each GET; `inventory` is only read when `mine` lacks the toy. */
function serve({ mine = [toy()], inventory = [], txs = [] }: { mine?: object[]; inventory?: object[]; txs?: object[] } = {}) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/toys' ? Promise.resolve(mine)
    : p === '/api/toys/inventory' ? Promise.resolve(inventory)
    : p === '/api/toy-transactions' ? Promise.resolve(txs)
    : Promise.reject(new Error(`unexpected GET ${p}`))
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps())
})

describe('ToySummaryScreen', () => {
  it('leads with the listing and how many families have asked, and opens the editor', async () => {
    serve({ txs: [request(), request({ id: 'tx2', requester_name: 'Priya Nadarajah' }), request({ id: 'tx3', toy_id: 'other' })] })
    render(<ToySummaryScreen id="t1" />)
    expect(
      await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted. 2 families have asked for it.')
    ).toBeTruthy()
    expect(screen.getByText('Photos, condition, notes')).toBeTruthy()
    fireEvent.press(screen.getByText('Edit listing'))
    expect(mockPush).toHaveBeenCalledWith('/toys/t1/edit')
  })

  it("opens an organisation's toy from the inventory", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1', switch_adapted: false })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Light-up drum — listed 4 June, good condition.')).toBeTruthy()
  })

  it('says so when the toy is not yours', async () => {
    serve({ mine: [] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  })

  it('pauses and resumes requests from the summary', async () => {
    serve()
    mockPatch.mockResolvedValueOnce(toy({ paused_at: '2026-09-30T00:00:00Z' })).mockResolvedValueOnce(toy({ paused_at: null }))
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Keeps it listed but hides the request button')).toBeTruthy()
    fireEvent.press(screen.getByText('Mark unavailable'))
    expect(await screen.findByText('Take requests again')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { paused_at: expect.any(String) })
    fireEvent.press(screen.getByText('Take requests again'))
    expect(await screen.findByText('Mark unavailable')).toBeTruthy()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/toys/t1', { paused_at: null })
  })

  it("lists each open request with the family's note, and Accept", async () => {
    serve({ txs: [request()] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Eastwood Special School')).toBeTruthy()
    expect(screen.getByText('For a class of four who share one switch')).toBeTruthy()
    // A personal toy needs a pickup address: the exchange's own form, seeded.
    fireEvent.press(screen.getByText('Accept'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx1?accept=1')
  })

  it("accepts an organisation's request on the spot", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({
      mine: [],
      inventory: [toy({ owner_id: null, owner_org_id: 'org1' })],
      txs: [request({ owner_id: null, owner_org_id: 'org1' })],
    })
    mockPost.mockResolvedValue({})
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Accept'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/accept', {})
    await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted.')
    expect(screen.queryByText('Eastwood Special School')).toBeNull()
  })

  it('shows no note when the newest message is not the family’s', async () => {
    serve({ txs: [request({ last_message: { body: 'Requested this toy for donation.', sender_id: 'fam1', kind: 'system', created_at: '' } })] })
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Eastwood Special School')
    expect(screen.queryByText('Requested this toy for donation.')).toBeNull()
  })

  it("retires an organisation's toy with a reason", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1' })] })
    mockPatch.mockResolvedValue(toy({ owner_id: null, owner_org_id: 'org1', retired_at: '2026-08-12T00:00:00Z', retired_note: 'Broken 12 Aug' }))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.changeText(await screen.findByLabelText('Why it is retired'), 'Broken 12 Aug')
    fireEvent.press(screen.getByText('Retire'))
    expect(await screen.findByText('Retired')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { retired_at: expect.any(String), retired_note: 'Broken 12 Aug' })
    // Retired is final for the request flow: no pause toggle to offer.
    expect(screen.queryByText('Mark unavailable')).toBeNull()
    expect(screen.queryByText('Take requests again')).toBeNull()
  })

  it('says why when the toy still has open requests', async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1' })] })
    mockPatch.mockRejectedValue(
      new Error('API PATCH /api/toys/t1 failed with status 409: This toy has open requests. Answer them first, then retire it.')
    )
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Retire'))
    expect(await screen.findByText('This toy has open requests. Answer them first, then retire it.')).toBeTruthy()
    expect(screen.queryByText('Retired')).toBeNull()
  })

  it('offers no Retire on a personal toy', async () => {
    serve()
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Edit listing')
    expect(screen.queryByText('Retire')).toBeNull()
  })
})

