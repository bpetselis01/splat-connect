import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { LiveTransaction } from '@/components/live-transaction'

// --- Mock strategy ---
// The Supabase channel is faked so the subscription's shape can be asserted
// without a socket, and the handlers it is given can be fired by hand — a real
// realtime connection would make this a test of the server, not the component.
// useRouter is mocked for the same reason as notifications-list.test.tsx: there
// is no app router context outside Next.
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

type Handler = (payload: unknown) => void
let onArgs: [string, Record<string, string>, Handler] | null = null
let subscribeCallback: ((status: string) => void) | null = null
const mockRemoveChannel = vi.fn()
const mockChannelName = vi.fn()

const channel = {
  on: vi.fn((...args: [string, Record<string, string>, Handler]) => {
    onArgs = args
    return channel
  }),
  subscribe: vi.fn((cb: (status: string) => void) => {
    subscribeCallback = cb
    return channel
  }),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      mockChannelName(name)
      return channel
    },
    removeChannel: mockRemoveChannel,
  }),
}))

/** Drive the tab in or out of the background, as visibilitychange does. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('LiveTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onArgs = null
    subscribeCallback = null
    setVisibility('visible')
    mockRefresh.mockClear()
  })

  // Tests: the subscription is scoped to this transaction's message inserts
  // How:   captures the arguments handed to channel.on()
  // Chain: an unfiltered subscription would wake this page for every exchange
  //        in the system, and a channel name shared between threads would let
  //        two open tabs collide on one socket topic
  it('subscribes to message inserts for this transaction only', () => {
    render(<LiveTransaction transactionId="tx-1" />)

    expect(mockChannelName).toHaveBeenCalledWith('toy-transaction:tx-1')
    expect(onArgs?.[0]).toBe('postgres_changes')
    expect(onArgs?.[1]).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'toy_transaction_messages',
      filter: 'transaction_id=eq.tx-1',
    })
  })

  // Tests: an arriving message refetches the server data
  // How:   fires the captured postgres_changes handler
  // Chain: this is the whole feature — without it the other party's reply sits
  //        in the database until the reader reloads
  it('refreshes when a message arrives', () => {
    render(<LiveTransaction transactionId="tx-1" />)
    mockRefresh.mockClear()

    onArgs?.[2]({ new: { id: 'm1' } })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // Tests: a successful join refetches, and a failed one does not
  // How:   invokes the subscribe status callback with each status
  // Chain: a rejoin after a dropped socket has a gap behind it — messages
  //        inserted while disconnected are never replayed, so the refetch is
  //        the only thing that closes it
  it('refreshes on a successful join and ignores other statuses', () => {
    render(<LiveTransaction transactionId="tx-1" />)
    mockRefresh.mockClear()

    subscribeCallback?.('CHANNEL_ERROR')
    subscribeCallback?.('TIMED_OUT')
    expect(mockRefresh).not.toHaveBeenCalled()

    subscribeCallback?.('SUBSCRIBED')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // Tests: returning to a backgrounded tab resyncs; leaving it does not
  // How:   toggles document.visibilityState and dispatches the event
  // Chain: a throttled tab can lose its socket without ever reporting a
  //        rejoin, so focus is the second resync trigger; refreshing on the
  //        way out would spend a request on a page nobody is looking at
  it('refreshes when the tab becomes visible, not when it is hidden', () => {
    render(<LiveTransaction transactionId="tx-1" />)
    mockRefresh.mockClear()

    setVisibility('hidden')
    expect(mockRefresh).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // Tests: unmounting tears down both the channel and the focus listener
  // How:   unmounts, then fires a visibility change
  // Chain: navigating between threads would otherwise stack a live channel and
  //        a refresh handler per visit, refetching a page that has been left
  it('removes the channel and stops listening on unmount', () => {
    const { unmount } = render(<LiveTransaction transactionId="tx-1" />)
    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel)

    mockRefresh.mockClear()
    setVisibility('hidden')
    setVisibility('visible')
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
