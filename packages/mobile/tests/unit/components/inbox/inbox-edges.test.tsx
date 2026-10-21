// packages/mobile/tests/unit/components/inbox/inbox-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { theme } from '../../../../lib/theme'
import { ScrollView, FlatList, StyleSheet } from 'react-native'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'
import type { Notification } from '@splat-connect/types'
import { InboxScreen } from '../../../../components/inbox/inbox-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
  },
}))

const mockInvalidate = jest.fn()
let mockCaps: { isAdmin: boolean } | null = null
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: () => mockInvalidate(),
  useCapabilities: () => ({ caps: mockCaps, loading: false }),
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const notification = (over: Partial<Notification>): Notification => ({
  id: 'n1',
  recipient_id: 'viewer1',
  type: 'toy_request',
  tutorial_id: null,
  tutorial_title: null,
  toy_transaction_id: 'tx1',
  toy_name: 'Switch car',
  idea_id: null,
  actor_name: 'Sam',
  read_at: null,
  created_at: '2026-08-31T12:00:00Z',
  ...over,
})

// Transactions default to none, which is also what a failed exchanges fetch
// degrades to: every exchange notification is then drawn as its own row.
function respond(notifications: unknown[], invites: unknown[] = [], transactions: unknown[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/notifications/me') return Promise.resolve(notifications)
    if (path === '/api/collaborators/me/invites') return Promise.resolve(invites)
    if (path === '/api/toy-transactions') return Promise.resolve(transactions)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

const tx = (over: object) => ({
  id: 'tx1',
  type: 'exchange',
  status: 'accepted',
  toy_name: 'Switch car',
  tutorial_title: null,
  requester_id: 'viewer1',
  owner_id: 'owner1',
  owner_org_id: null,
  other_party_name: 'Northside Therapy',
  requester_name: 'Viewer',
  last_message: null,
  created_at: '2026-08-30T12:00:00Z',
  updated_at: '2026-08-30T12:00:00Z',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  respond([])
  mockPatch.mockResolvedValue(null)
  mockPost.mockResolvedValue(null)
})



const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))
const tutorial = (over: Partial<Notification> = {}) =>
  notification({ id: 't1', type: 'tutorial_approved', tutorial_id: 'g1', tutorial_title: 'Bubble machine', toy_transaction_id: null, toy_name: null, ...over })

describe('InboxScreen failure and scale edges', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}) })

  it('when every call fails offline it says so with Try again, not an empty inbox', async () => {
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<InboxScreen />)
    expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
    expect(screen.queryByText('Nothing yet.')).toBeNull()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('when every call fails for another reason it says it could not load', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    render(<InboxScreen />)
    expect(await screen.findByText("Couldn't load your inbox.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('Try again refetches all three and shows the inbox once it works', async () => {
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<InboxScreen />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    respond([notification({})])
    fireEvent.press(retry)
    expect(await screen.findByText('Sam requested Switch car')).toBeTruthy()
    expect(screen.queryByText('You seem to be offline.')).toBeNull()
  })

  it('keeps real exchanges when only the notifications and invites fail', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/toy-transactions' ? Promise.resolve([tx({})]) : Promise.reject(new TypeError('Network request failed'))
    )
    render(<InboxScreen />)
    expect(await screen.findByText('Northside Therapy')).toBeTruthy()
    expect(screen.queryByText('You seem to be offline.')).toBeNull()
  })

  it('shows skeletons while loading, then replaces them', async () => {
    respond([notification({})])
    render(<InboxScreen />)
    expect(screen.queryByText('Sam requested Switch car')).toBeNull()
    expect(await screen.findByText('Sam requested Switch car')).toBeTruthy()
  })

  it('a notification of a type this build does not know leaves the half empty, not blank', async () => {
    respond([notification({ id: 'x', type: 'brand_new_type' as Notification['type'], toy_transaction_id: null })])
    render(<InboxScreen />)
    await waitFor(() => expect(screen.getByText('Nothing yet.')).toBeTruthy())
  })

  it('2,000 unread notifications count in the eyebrow and clear with ONE bucket call, not 2,000', async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => tutorial({ id: `n${i}`, created_at: '2026-08-31T12:00:00Z' }))
    respond(rows)
    render(<InboxScreen initialSegment="notifications" />)
    expect(await screen.findByText('2000 unread')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Mark Tutorials read' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith('/api/notifications/me/read', { bucket: 'tutorials' })
    expect(mockPatch).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('2000 unread')).toBeNull())
  }, 30000)

  it('marking one bucket read leaves the other bucket unread', async () => {
    respond([tutorial({ id: 'a' }), notification({ id: 'c', type: 'idea_approved', toy_transaction_id: null, toy_name: null, idea_id: 'i1' })])
    render(<InboxScreen initialSegment="notifications" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Mark Tutorials read' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark Tutorials read' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Mark Challenges read' })).toBeTruthy()
  })

  it('a failed mark-all still clears the count on screen, and still tells the badges to refetch', async () => {
    mockPost.mockRejectedValue(new Error('500'))
    respond([tutorial({ id: 'a' }), tutorial({ id: 'b' })])
    render(<InboxScreen initialSegment="notifications" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Mark Tutorials read' }))
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalled())
    expect(screen.queryByText('2 unread')).toBeNull()
  })

  it('an already-read bucket offers no Mark read at all (zero hidden)', async () => {
    respond([tutorial({ read_at: '2026-08-31T13:00:00Z' })])
    render(<InboxScreen initialSegment="notifications" />)
    await screen.findByText('"Bubble machine" was approved and is now published')
    expect(screen.queryByText(/unread/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Mark .* read/ })).toBeNull()
  })

  it('tapping an unread row twice marks it once', async () => {
    respond([tutorial({ id: 'a' })])
    render(<InboxScreen initialSegment="notifications" />)
    const row = await screen.findByText('"Bubble machine" was approved and is now published')
    fireEvent.press(row)
    fireEvent.press(row)
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(2)
  })

  it('opening one unread row marks only that row, and the unread count drops by one', async () => {
    respond([tutorial({ id: 'a' }), tutorial({ id: 'b', tutorial_title: 'Other' })])
    render(<InboxScreen initialSegment="notifications" />)
    expect(await screen.findByText('2 unread')).toBeTruthy()
    fireEvent.press(screen.getByText('"Other" was approved and is now published'))
    await waitFor(() => expect(screen.getByText('1 unread')).toBeTruthy())
    expect(mockPatch).toHaveBeenCalledWith('/api/notifications/b', { read: true })
    expect(mockPatch).not.toHaveBeenCalledWith('/api/notifications/a', expect.anything())
  })

  it('opening a thread marks every unread notification about it, and none about another', async () => {
    respond(
      [
        notification({ id: 'a', type: 'toy_message', toy_transaction_id: 'tx1' }),
        notification({ id: 'b', type: 'toy_message', toy_transaction_id: 'tx1' }),
        notification({ id: 'c', type: 'toy_message', toy_transaction_id: 'tx2' }),
        notification({ id: 'd', type: 'toy_message', toy_transaction_id: 'tx1', read_at: '2026-08-31T13:00:00Z' }),
      ],
      [],
      [tx({ id: 'tx1' }), tx({ id: 'tx2', other_party_name: 'Eastwood' })]
    )
    render(<InboxScreen />)
    fireEvent.press(await screen.findByLabelText('Switch car with Northside Therapy'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
    const ids = mockPatch.mock.calls.map((c) => c[0]).sort()
    expect(ids).toEqual(['/api/notifications/a', '/api/notifications/b'])
  })

  it('an exchange notification whose thread is missing from the list is still shown', async () => {
    respond([notification({ id: 'o', type: 'toy_request', toy_transaction_id: 'gone' })], [], [tx({ id: 'other' })])
    render(<InboxScreen />)
    expect(await screen.findByText('Sam requested Switch car')).toBeTruthy()
    expect(screen.getByText('Northside Therapy')).toBeTruthy()
  })

  it('threads sort by their last message, newest first, whatever order the API sent', async () => {
    respond([], [], [
      tx({ id: 'old', other_party_name: 'AAA Old', updated_at: '2026-01-01T00:00:00Z' }),
      tx({ id: 'new', other_party_name: 'ZZZ New', updated_at: '2026-09-01T00:00:00Z' }),
      tx({ id: 'mid', other_party_name: 'MMM Mid', updated_at: '2026-05-01T00:00:00Z', last_message: { body: 'hi', sender_id: 'x', kind: 'user', created_at: '2026-10-01T00:00:00Z' } }),
    ])
    render(<InboxScreen />)
    await screen.findByText('ZZZ New')
    const order = screen.getAllByText(/Old|New|Mid/).map((n) => n.props.children)
    expect(order).toEqual(['MMM Mid', 'ZZZ New', 'AAA Old'])
  })

  it('a thread with an unparseable date does not break the list', async () => {
    respond([], [], [tx({ id: 'a', updated_at: 'garbage' }), tx({ id: 'b', other_party_name: 'Fine Co' })])
    render(<InboxScreen />)
    expect(await screen.findByText('Fine Co')).toBeTruthy()
    expect(screen.getByText('Northside Therapy')).toBeTruthy()
  })

  it('a thread with no other-party name falls back to what it is about', async () => {
    respond([], [], [tx({ other_party_name: null, toy_name: 'Switch car' })])
    render(<InboxScreen />)
    expect(await screen.findByLabelText('Switch car with Switch car')).toBeTruthy()
  })

  it('a message from the other side is not prefixed You, and a system line is never You', async () => {
    respond([], [], [
      tx({ id: 'a', other_party_name: 'Them', last_message: { body: 'From them', sender_id: 'owner1', kind: 'user', created_at: '2026-08-31T00:00:00Z' } }),
      tx({ id: 'b', other_party_name: 'Sys', last_message: { body: 'Accepted', sender_id: 'viewer1', kind: 'system', created_at: '2026-08-30T00:00:00Z' } }),
    ])
    render(<InboxScreen />)
    expect(await screen.findByText('From them')).toBeTruthy()
    expect(screen.getByText('Accepted')).toBeTruthy()
    expect(screen.queryByText(/^You:/)).toBeNull()
  })

  it('shows the second line: a reason body wins over the date line', async () => {
    respond([tutorial({ id: 'r', type: 'tutorial_rejected', body: 'Photos are blurry' })])
    render(<InboxScreen initialSegment="notifications" />)
    expect(await screen.findByText('Photos are blurry')).toBeTruthy()
  })

  it('titles with quotes, angle brackets, emoji and RTL render as plain text', async () => {
    const title = '<b>"Tom & Jerry"</b> 🧸 سارة'
    respond([tutorial({ tutorial_title: title })])
    render(<InboxScreen initialSegment="notifications" />)
    expect(await screen.findByText(`"${title}" was approved and is now published`)).toBeTruthy()
  })

  it('an unparseable created_at does not crash the row', async () => {
    respond([tutorial({ created_at: 'not a date' })])
    render(<InboxScreen initialSegment="notifications" />)
    expect(await screen.findByText('"Bubble machine" was approved and is now published')).toBeTruthy()
  })

  it('a missing actor name still reads as a sentence', async () => {
    respond([notification({ type: 'toy_request', actor_name: '' })])
    render(<InboxScreen />)
    expect(await screen.findByText(/requested Switch car/)).toBeTruthy()
  })
})

describe('InboxScreen invites', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}) })
  const invited = () => tutorial({ id: 'i', type: 'collaborator_invited' })

  it('a double tap on Accept answers once, and both buttons lock while it is in flight', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    respond([invited()], [{ id: 'inv1', tutorial_id: 'g1', status: 'pending' }])
    render(<InboxScreen initialSegment="notifications" />)
    const accept = await screen.findByRole('button', { name: 'Accept' })
    fireEvent.press(accept); fireEvent.press(accept)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled()
    resolve(null)
  })

  it('a failed answer unlocks the buttons so it can be tried again', async () => {
    mockPost.mockRejectedValueOnce(new Error('500'))
    respond([invited()], [{ id: 'inv1', tutorial_id: 'g1', status: 'pending' }])
    render(<InboxScreen initialSegment="notifications" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).not.toBeDisabled())
    mockPost.mockResolvedValue(null)
    fireEvent.press(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
  })

  it('an answered invite refetches the lists', async () => {
    respond([invited()], [{ id: 'inv1', tutorial_id: 'g1', status: 'pending' }])
    render(<InboxScreen initialSegment="notifications" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(mockGet.mock.calls.filter((c) => c[0] === '/api/notifications/me').length).toBeGreaterThan(1))
  })

  it('an invite for a different guide gives this row no buttons', async () => {
    respond([invited()], [{ id: 'inv9', tutorial_id: 'other', status: 'pending' }])
    render(<InboxScreen initialSegment="notifications" />)
    await screen.findByText(/invited you to collaborate/)
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })
})
