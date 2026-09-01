// packages/mobile/tests/unit/components/inbox/inbox-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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

function respond(notifications: unknown[], invites: unknown[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/notifications/me') return Promise.resolve(notifications)
    if (path === '/api/collaborators/me/invites') return Promise.resolve(invites)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  respond([])
  mockPatch.mockResolvedValue(null)
  mockPost.mockResolvedValue(null)
})

describe('InboxScreen', () => {
  it('groups rows into the three buckets and counts what is unread in each', async () => {
    respond([
      notification({ id: 'n1', type: 'toy_request', toy_transaction_id: 'tx1' }),
      notification({ id: 'n2', type: 'toy_message', toy_transaction_id: 'tx2' }),
      notification({ id: 'n3', type: 'toy_accepted', toy_transaction_id: 'tx3', read_at: '2026-08-31T13:00:00Z' }),
      notification({
        id: 'n4',
        type: 'tutorial_approved',
        tutorial_id: 't1',
        tutorial_title: 'Bubble machine',
        toy_transaction_id: null,
      }),
      notification({
        id: 'n5',
        type: 'challenge_joined',
        idea_id: 'i1',
        toy_transaction_id: null,
        read_at: '2026-08-31T13:00:00Z',
      }),
    ])
    render(<InboxScreen />)

    expect(await screen.findByText('Exchanges')).toBeTruthy()
    expect(screen.getByText('Tutorials')).toBeTruthy()
    expect(screen.getByText('Challenges')).toBeTruthy()
    // Two of the three exchange rows are unread; one of one tutorial row is.
    expect(screen.getByText('2 unread')).toBeTruthy()
    expect(screen.getByText('1 unread')).toBeTruthy()
    // The challenges bucket is fully read, so it offers no count and nothing
    // to mark — a "Mark read" on an already-read group is a no-op button.
    expect(screen.queryByRole('button', { name: 'Mark Challenges read' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Mark Exchanges read' })).toBeTruthy()
  })

  it("renders web's copy for a row", async () => {
    respond([notification({ type: 'toy_accepted', toy_name: 'Switch car' })])
    render(<InboxScreen />)
    expect(await screen.findByText('Sam accepted your request for Switch car')).toBeTruthy()
  })

  it('marks an unread row read and opens what it is about', async () => {
    respond([notification({ id: 'n7', type: 'toy_message', toy_transaction_id: 'tx7' })])
    render(<InboxScreen />)

    fireEvent.press(await screen.findByText('Sam sent a message about Switch car'))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/notifications/n7', { read: true }))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx7')
  })

  it('does not re-mark a row that is already read, but still opens it', async () => {
    respond([notification({ id: 'n8', read_at: '2026-08-31T13:00:00Z' })])
    render(<InboxScreen />)

    fireEvent.press(await screen.findByText('Sam requested Switch car'))

    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx1')
  })

  it('opens the row even when marking it read fails', async () => {
    mockPatch.mockRejectedValue(new Error('offline'))
    respond([notification({ id: 'n9', toy_transaction_id: 'tx9' })])
    render(<InboxScreen />)

    fireEvent.press(await screen.findByText('Sam requested Switch car'))
    // Navigation must not wait on, or be cancelled by, a bookkeeping write.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/exchanges/tx9'))
  })

  it('marks a whole bucket read from its eyebrow', async () => {
    respond([
      notification({ id: 'n1', type: 'toy_request' }),
      notification({ id: 'n2', type: 'toy_message', toy_transaction_id: 'tx2' }),
    ])
    render(<InboxScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Mark Exchanges read' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/notifications/me/read', { bucket: 'exchanges' })
    )
    // Optimistic: the count clears without waiting for the refetch.
    await waitFor(() => expect(screen.queryByText('2 unread')).toBeNull())
  })

  it('offers Accept and Decline on an invite that is still pending', async () => {
    respond(
      [
        notification({
          id: 'n1',
          type: 'collaborator_invited',
          tutorial_id: 't1',
          tutorial_title: 'Bubble machine',
          toy_transaction_id: null,
        }),
      ],
      [{ id: 'inv1', tutorial_id: 't1', status: 'pending' }]
    )
    render(<InboxScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/collaborators/invites/inv1/accept', {})
    )
  })

  it('declines an invite through the same route', async () => {
    respond(
      [
        notification({
          id: 'n1',
          type: 'collaborator_invited',
          tutorial_id: 't1',
          tutorial_title: 'Bubble machine',
          toy_transaction_id: null,
        }),
      ],
      [{ id: 'inv1', tutorial_id: 't1', status: 'pending' }]
    )
    render(<InboxScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/collaborators/invites/inv1/decline', {})
    )
  })

  it('shows no invite buttons once the invite is answered and gone', async () => {
    respond([
      notification({
        id: 'n1',
        type: 'collaborator_invited',
        tutorial_id: 't1',
        tutorial_title: 'Bubble machine',
        toy_transaction_id: null,
      }),
    ])
    render(<InboxScreen />)

    await screen.findByText('Sam invited you to collaborate on "Bubble machine"')
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('says nothing yet when there is nothing', async () => {
    render(<InboxScreen />)
    expect(await screen.findByText('Nothing yet.')).toBeTruthy()
  })

  it('keeps the notifications when only the invites call fails', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/api/notifications/me') return Promise.resolve([notification({})])
      return Promise.reject(new Error('down'))
    })
    render(<InboxScreen />)

    // Losing the invites costs two buttons, not the whole inbox.
    expect(await screen.findByText('Sam requested Switch car')).toBeTruthy()
  })

  it('draws its own header only where there is no native one', async () => {
    const { unmount } = render(<InboxScreen showHeader />)
    expect(await screen.findByText('Everything waiting on you, newest first.')).toBeTruthy()
    unmount()

    render(<InboxScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Everything waiting on you, newest first.')).toBeNull()
  })
})
