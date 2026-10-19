// journeys: L16 L17 L28
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgRequestsScreen } from '../../../../components/organisation/org-requests-screen'
import { OrgMessagesScreen } from '../../../../components/organisation/org-messages-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (e: () => void | (() => void)) => useEffect(e, [e]) }
})
let mockCaps: { ledOrgs: { id: string; name: string }[] } | null = { ledOrgs: [{ id: 'o1', name: 'Northside' }] }
let mockLoading = false
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: mockLoading }) }))

const tx = (over: object) => ({
  id: 'tx1', type: 'exchange', status: 'requested', toy_name: 'Switch car', tutorial_title: null, owner_org_id: 'o1',
  requester_name: 'Priya', other_party_name: 'Priya', last_message: null, toy_cover_photo_url: null, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps = { ledOrgs: [{ id: 'o1', name: 'Northside' }] }
  mockLoading = false
})

describe('OrgRequestsScreen', () => {
  const serve = (rows: unknown) => mockGet.mockResolvedValue(rows)

  it('asks for the owner-side queue', async () => {
    serve([])
    render(<OrgRequestsScreen />)
    await screen.findByText('No toy requests right now.')
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions?role=owner')
  })

  it('opens on the first tab that has something waiting, and counts waiting ones in each chip', async () => {
    serve([tx({ id: 'p1', type: 'print', toy_name: 'Parts' }), tx({ id: 'p2', type: 'print' }), tx({ id: 'b1', type: 'build', status: 'accepted' })])
    render(<OrgRequestsScreen />)
    expect(await screen.findByRole('radio', { name: 'Print parts · 2' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Print parts · 2' }).props.accessibilityState?.checked ?? screen.getByRole('radio', { name: 'Print parts · 2' }).props.accessibilityState?.selected).toBeTruthy()
    // an accepted (not waiting) build adds no count
    expect(screen.getByRole('radio', { name: 'Build a guide' })).toBeTruthy()
  })

  it('leaves out other organisations, finished records and personal handoffs', async () => {
    serve([
      tx({ id: 'mine' }),
      tx({ id: 'other-org', owner_org_id: 'oX', requester_name: 'Stranger' }),
      tx({ id: 'done', status: 'completed', requester_name: 'Finished Fam' }),
      tx({ id: 'personal', owner_org_id: null, requester_name: 'Personal Fam' }),
      tx({ id: 'declined', status: 'rejected', requester_name: 'Declined Fam' }),
    ])
    render(<OrgRequestsScreen />)
    expect(await screen.findByText('Priya')).toBeTruthy()
    for (const gone of ['Stranger', 'Finished Fam', 'Personal Fam', 'Declined Fam']) expect(screen.queryByText(gone)).toBeNull()
  })

  it('lists waiting requests before accepted ones', async () => {
    serve([tx({ id: 'a', status: 'accepted', requester_name: 'Accepted Fam' }), tx({ id: 'r', requester_name: 'Waiting Fam' })])
    render(<OrgRequestsScreen />)
    await screen.findByText('Waiting Fam')
    const names = screen.getAllByText(/Fam$/).map((n) => n.props.children)
    expect(names).toEqual(['Waiting Fam', 'Accepted Fam'])
  })

  it.each([
    ['exchange', 'tx1', '/exchanges/tx1'],
    ['donation', 'tx1', '/exchanges/tx1'],
    ['build', 'tx1', '/exchanges/build/tx1'],
    ['print', 'tx1', '/printing/jobs/tx1'],
  ])('a %s opens %s', async (type, id, route) => {
    serve([tx({ id, type })])
    render(<OrgRequestsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Priya/ }))
    expect(mockPush).toHaveBeenCalledWith(route)
  })

  it('a requester with no name reads "A family"', async () => {
    serve([tx({ requester_name: null })])
    render(<OrgRequestsScreen />)
    expect(await screen.findByText('A family')).toBeTruthy()
  })

  it('shows the family\'s own words in quotes, but never a system line', async () => {
    serve([
      tx({ id: 'a', last_message: { kind: 'user', body: 'Can we collect Friday?' } }),
      tx({ id: 'b', requester_name: 'Sys Fam', last_message: { kind: 'system', body: 'Accepted automatically' } }),
    ])
    render(<OrgRequestsScreen />)
    expect(await screen.findByText(/“Can we collect Friday\?”/)).toBeTruthy()
    expect(screen.queryByText(/Accepted automatically/)).toBeNull()
  })

  it('a failed load says so rather than showing an empty queue or a spinner forever', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    render(<OrgRequestsScreen />)
    expect(await screen.findByText("Couldn't load the requests.")).toBeTruthy()
  })

  it('a switch of tab shows that tab\'s empty line', async () => {
    serve([tx({})])
    render(<OrgRequestsScreen />)
    await screen.findByText('Priya')
    fireEvent.press(screen.getByRole('radio', { name: 'Build a guide' }))
    expect(screen.getByText('No build requests right now.')).toBeTruthy()
  })

  it('names the organisation the leader leads in the lede, or "your organisation" when none', async () => {
    serve([])
    const a = render(<OrgRequestsScreen />)
    expect(await screen.findByText(/Everything a family can ask of Northside/)).toBeTruthy()
    a.unmount()
    mockCaps = { ledOrgs: [] }
    render(<OrgRequestsScreen />)
    expect(await screen.findByText(/ask of your organisation/)).toBeTruthy()
  })

  it('when capabilities could not load, shows the empty queue instead of skeletons forever', async () => {
    mockCaps = null
    mockLoading = false
    serve([tx({})])
    render(<OrgRequestsScreen />)
    expect(await screen.findByText('No toy requests right now.')).toBeTruthy()
  })
})

describe('OrgMessagesScreen', () => {
  const conv = (over: object) => ({
    id: 'c1', org_id: 'o1', profile_id: 'fam1', created_at: '', updated_at: '2026-09-01T00:00:00Z', person_name: 'Priya', last_message: null, ...over,
  })
  const serve = (byOrg: Record<string, unknown>) =>
    mockGet.mockImplementation((path: string) => {
      const id = path.split('/')[3]
      const v = byOrg[id]
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v ?? [])
    })

  it('says nobody has written when every conversation list is empty', async () => {
    serve({ o1: [] })
    render(<OrgMessagesScreen />)
    expect(await screen.findByText('Nobody has written yet.')).toBeTruthy()
  })

  it('merges two organisations, newest first, and says which one each is to', async () => {
    mockCaps = { ledOrgs: [{ id: 'o1', name: 'Northside' }, { id: 'o2', name: 'Eastwood' }] }
    serve({ o1: [conv({ id: 'a', person_name: 'Older', updated_at: '2026-01-01T00:00:00Z' })], o2: [conv({ id: 'b', person_name: 'Newer', updated_at: '2026-09-01T00:00:00Z' })] })
    render(<OrgMessagesScreen />)
    await screen.findByText('Newer')
    expect(screen.getAllByText(/^(Older|Newer)$/).map((n) => n.props.children)).toEqual(['Newer', 'Older'])
    expect(screen.getByText('To Eastwood')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Newer, to Eastwood' })).toBeTruthy()
  })

  it('one organisation failing still lists the other', async () => {
    mockCaps = { ledOrgs: [{ id: 'o1', name: 'Northside' }, { id: 'o2', name: 'Eastwood' }] }
    serve({ o1: new Error('500'), o2: [conv({ id: 'b', person_name: 'Survivor' })] })
    render(<OrgMessagesScreen />)
    expect(await screen.findByText('Survivor')).toBeTruthy()
  })

  it('with one organisation there is no "To" line and the label is just the name', async () => {
    serve({ o1: [conv({})] })
    render(<OrgMessagesScreen />)
    expect(await screen.findByRole('button', { name: 'Priya' })).toBeTruthy()
    expect(screen.queryByText(/^To /)).toBeNull()
  })

  it('prefixes You: only when a leader wrote the last message', async () => {
    serve({ o1: [
      conv({ id: 'a', person_name: 'A', last_message: { body: 'family said', sender_id: 'fam1', created_at: '' } }),
      conv({ id: 'b', person_name: 'B', updated_at: '2026-08-01T00:00:00Z', last_message: { body: 'we said', sender_id: 'lead', created_at: '' } }),
    ] })
    render(<OrgMessagesScreen />)
    expect(await screen.findByText('family said')).toBeTruthy()
    expect(screen.getByText('You: we said')).toBeTruthy()
  })

  it('opens the conversation by its own id', async () => {
    serve({ o1: [conv({ id: 'conv-77' })] })
    render(<OrgMessagesScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Priya' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/messages/[cid]', params: { cid: 'conv-77' } })
  })

  it('a person name with quotes, brackets, emoji and RTL renders as text', async () => {
    const name = '<b>"Sam" & Co</b> 🧸 سارة'
    serve({ o1: [conv({ person_name: name })] })
    render(<OrgMessagesScreen />)
    expect(await screen.findByText(name)).toBeTruthy()
  })

  it('a leader of no organisation sees the empty inbox, and no calls are made', async () => {
    mockCaps = { ledOrgs: [] }
    render(<OrgMessagesScreen />)
    expect(await screen.findByText('Nobody has written yet.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('when capabilities could not load, shows the empty inbox instead of skeletons forever', async () => {
    mockCaps = null
    mockLoading = false
    render(<OrgMessagesScreen />)
    expect(await screen.findByText('Nobody has written yet.')).toBeTruthy()
  })
})
