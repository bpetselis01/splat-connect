import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ChallengeThread } from '@/components/challenge-thread'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ToyIdeaMessage, ToyIdeaParticipant } from '@splat-connect/types'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

// Same fake-channel strategy as live-transaction.test.tsx: the socket is
// faked so the component can mount and subscribe without a real connection.
// Nothing here drives the subscribe callback by hand — these tests only need
// the mount path to work, not the live-update path.
const mockRemoveChannel = vi.fn()
const channel = {
  on: vi.fn(() => channel),
  subscribe: vi.fn(() => channel),
}
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: mockRemoveChannel,
  }),
}))

const PARTICIPANTS: ToyIdeaParticipant[] = [
  { idea_id: 'idea-1', profile_id: 'p1', joined_at: '2026-08-01T00:00:00Z', removed_at: null, removed_by: null, name: 'Ash' },
  { idea_id: 'idea-1', profile_id: 'p2', joined_at: '2026-08-01T00:00:00Z', removed_at: null, removed_by: null, name: 'Casey' },
]

function baseProps(overrides: Partial<Parameters<typeof ChallengeThread>[0]> = {}) {
  return {
    ideaId: 'idea-1',
    status: 'challenge' as const,
    viewerId: 'p1',
    authorId: 'author-1',
    authorName: 'Robin',
    participants: PARTICIPANTS,
    ...overrides,
  }
}

describe('ChallengeThread', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Tests: the security-shaped gate — a public challenge, a private thread
  // How:   renders a signed-in viewer who is in neither authorId nor participants
  // Chain: canRead is computed from author/participants, not from whether the
  //        messages fetch came back empty, so this must never touch
  //        GET /api/ideas/:id/messages at all — a stranger sees Join, never an
  //        error, never the log
  it('shows Join and no thread for a signed-in viewer who is neither author nor participant', () => {
    const get = vi.spyOn(browserApiClient, 'get')
    render(<ChallengeThread {...baseProps({ viewerId: 'stranger-1' })} />)

    expect(screen.getByRole('button', { name: /join this challenge/i })).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  // Tests: nameFor resolves the author by id, a current participant by id, and
  //        falls back to "Someone" for a sender in neither
  // How:   one message per case, rendered through the real ExchangeChat
  // Chain: the fallback is the deliberate call from Task 14's brief — a
  //        participant who has since left must not break the thread or crash
  //        name resolution, and must not get a wider profiles query to fix it
  it('resolves sender names from authorName and participants, with a "Someone" fallback for a departed sender', async () => {
    const messages: ToyIdeaMessage[] = [
      { id: 'm1', idea_id: 'idea-1', sender_id: 'author-1', kind: 'user', body: 'From the author', created_at: '2026-08-01T00:00:00Z' },
      { id: 'm2', idea_id: 'idea-1', sender_id: 'p2', kind: 'user', body: 'From Casey', created_at: '2026-08-01T00:01:00Z' },
      { id: 'm3', idea_id: 'idea-1', sender_id: 'ghost-1', kind: 'user', body: 'From someone who left', created_at: '2026-08-01T00:02:00Z' },
    ]
    vi.spyOn(browserApiClient, 'get').mockResolvedValue(messages)

    render(<ChallengeThread {...baseProps()} />)

    await waitFor(() => expect(screen.getByText('From the author')).toBeInTheDocument())
    expect(screen.getByText('Robin')).toBeInTheDocument()
    expect(screen.getByText('Casey')).toBeInTheDocument()
    expect(screen.getByText('Someone')).toBeInTheDocument()
  })

  // Tests: a failed fetch is handled honestly, not thrown and not stuck
  // How:   rejects browserApiClient.get and waits for the error copy
  // Chain: this is a client-fetched thread with no server-rendered fallback,
  //        so a swallowed rejection would leave a signed-in participant
  //        staring at "Loading the conversation…" forever
  it('shows an error instead of hanging on "Loading…" when the messages fetch fails', async () => {
    vi.spyOn(browserApiClient, 'get').mockRejectedValue(new Error('network down'))

    render(<ChallengeThread {...baseProps()} />)

    await waitFor(() =>
      expect(screen.getByText(/could not load the conversation/i)).toBeInTheDocument()
    )
    expect(screen.queryByText(/loading the conversation/i)).not.toBeInTheDocument()
  })

  // Tests: IMPORTANT 4 — a participant can actually leave from this page.
  //        DELETE /api/ideas/:id/participants/:profileId had no caller
  //        anywhere in the web app before this.
  // How:   viewer p1 is in participants; clicks Leave; asserts the DELETE hits
  //        their own profile id and the page refreshes
  // Chain: leaving and being removed share the same route and the same
  //        removeParticipant function, so a passing "leave" case also proves
  //        the DELETE call shape "remove" relies on
  it('lets a participant leave, calling DELETE on their own id and refreshing', async () => {
    vi.spyOn(browserApiClient, 'get').mockResolvedValue([])
    const del = vi.spyOn(browserApiClient, 'delete').mockResolvedValue(undefined)

    render(<ChallengeThread {...baseProps({ viewerId: 'p1' })} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /leave this challenge/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /leave this challenge/i }))

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/ideas/idea-1/participants/p1'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  // Tests: the author sees every participant with a Remove control, and
  //        Remove targets that participant's id, not the author's own
  // How:   viewer is authorId; asserts both participant names render with a
  //        Remove button, and clicking one calls DELETE on that profile_id
  // Chain: no removal surface existed anywhere before this — an author could
  //        not remove anyone through the product
  it('lets the author remove a specific participant', async () => {
    vi.spyOn(browserApiClient, 'get').mockResolvedValue([])
    const del = vi.spyOn(browserApiClient, 'delete').mockResolvedValue(undefined)

    render(<ChallengeThread {...baseProps({ viewerId: 'author-1' })} />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2))

    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[1])

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/ideas/idea-1/participants/p2'))
  })

  // Tests: the 404 the API returns for "not actually a participant" is
  //        surfaced honestly, not folded into the generic error copy
  // How:   rejects browserApiClient.delete with an ApiError carrying status 404
  // Chain: this is the exact response toy-ideas.ts sends when the delete
  //        matches no row (a race between two removals is the realistic
  //        trigger), and the brief asks for it to be "handled honestly"
  it('shows the honest 404 message when the target was never a participant', async () => {
    vi.spyOn(browserApiClient, 'get').mockResolvedValue([])
    const notFound = Object.assign(new Error('not found'), { status: 404 })
    vi.spyOn(browserApiClient, 'delete').mockRejectedValue(notFound)

    render(<ChallengeThread {...baseProps({ viewerId: 'p1' })} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /leave this challenge/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /leave this challenge/i }))

    await waitFor(() =>
      expect(screen.getByText(/that person is not part of this challenge/i)).toBeInTheDocument()
    )
  })
})
