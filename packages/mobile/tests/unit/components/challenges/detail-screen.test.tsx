// packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { ChallengeDetailScreen } from '../../../../components/challenges/detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockPush = jest.fn()
// useFocusEffect stands in as a mount-time effect (no navigator in a unit
// render) — the same substitution exchanges/thread-screen.test.tsx makes, and
// it is what lets the poll below be driven by fake timers.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})

const mockToggle = jest.fn()
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({
    savedIds: { tutorials: [], toys: [], challenges: [] },
    isSaved: () => false,
    toggle: mockToggle,
  }),
}))

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const viewer = (id: string) => ({
  caps: {
    profile: { id, name: 'Viewer', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})
const signedOut = { caps: null, loading: false, refresh: jest.fn() }

const message = (over: object = {}) => ({
  id: 'm1',
  idea_id: 'c1',
  sender_id: 'author1',
  kind: 'user',
  body: 'Has anyone tried a lever?',
  created_at: '2026-08-02T03:00:00Z',
  ...over,
})

const detail = (over: object = {}) => ({
  id: 'c1',
  author_id: 'author1',
  author_name: 'Priya',
  title: 'A switch a toddler can hit',
  summary: 'Every switch we have needs more force than she can manage.',
  description: 'She swipes rather than presses, so a button never latches.',
  intended_use: 'Turning on a bubble machine during therapy.',
  primary_user: 'A three-year-old with low muscle tone.',
  contact_prefs: ['clarification'],
  status: 'challenge',
  tutorial_id: null,
  participants: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  ...over,
})

/** Answers the brief and the thread separately, in whatever order they fire. */
function respond(brief: object, messages: unknown[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/public/challenges/c1') return Promise.resolve(brief)
    if (path === '/api/ideas/c1/messages') return Promise.resolve(messages)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

const joinedDetail = (over: object = {}) =>
  detail({ participants: [{ profile_id: 'viewer1', name: 'Viewer' }], ...over })

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(viewer('viewer1'))
  mockGet.mockResolvedValue(detail())
})

describe('ChallengeDetailScreen', () => {
  it('renders the brief the public route returns', async () => {
    mockGet.mockResolvedValue(detail({ participants: [{ profile_id: 'p1', name: 'Sam' }] }))
    render(<ChallengeDetailScreen id="c1" />)

    expect(await screen.findByText('A switch a toddler can hit')).toBeTruthy()
    expect(screen.getByText('Every switch we have needs more force than she can manage.')).toBeTruthy()
    expect(screen.getByText('Posted by Priya')).toBeTruthy()
    expect(screen.getByText('She swipes rather than presses, so a button never latches.')).toBeTruthy()
    expect(screen.getByText('Turning on a bubble machine during therapy.')).toBeTruthy()
    expect(screen.getByText('A three-year-old with low muscle tone.')).toBeTruthy()
    expect(screen.getByText('Clarification')).toBeTruthy()
    expect(screen.getByText('Sam')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/challenges/c1')
  })

  it('gates the conversation behind joining, in web’s words', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    expect(
      await screen.findByText('Join this challenge to read and take part in the conversation.')
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join this challenge' })).toBeTruthy()
  })

  it('joins, then reloads the brief so the new participant shows', async () => {
    // The brief changes because the join landed, which is the thing being
    // tested — a canned second response would pass even if nothing was posted.
    let brief: object = detail()
    mockGet.mockImplementation((path: string) => {
      if (path === '/api/public/challenges/c1') return Promise.resolve(brief)
      if (path === '/api/ideas/c1/messages') return Promise.resolve([])
      return Promise.reject(new Error(`unexpected GET ${path}`))
    })
    mockPost.mockImplementation(() => {
      brief = joinedDetail()
      return Promise.resolve({ joined: true })
    })
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Join this challenge' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/join', {}))
    expect(await screen.findByText('✓ You joined')).toBeTruthy()
  })

  it('keeps the brief on screen when the reload after a join fails', async () => {
    mockPost.mockResolvedValue({ joined: true })
    mockGet.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new Error('flaky'))
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Join this challenge' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // The join landed; only the reload dropped. Replacing a loaded brief with
    // "couldn't load" here would report a failure that did not happen.
    expect(screen.getByText('A switch a toddler can hit')).toBeTruthy()
    expect(screen.queryByText("Couldn't load this challenge.")).toBeNull()
  })

  it('says so when joining fails, and leaves the button usable', async () => {
    mockPost.mockRejectedValue(new Error('nope'))
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Join this challenge' }))
    expect(await screen.findByText('Could not join this challenge. Please try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join this challenge' }).props.accessibilityState).toMatchObject({
      disabled: false,
    })
  })

  it('confirms before leaving, then deletes the viewer’s own participant row', async () => {
    respond(joinedDetail())
    mockDelete.mockResolvedValue(null)
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.style === 'destructive')?.onPress?.()
      })
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Leave' }))

    expect(alertSpy).toHaveBeenCalled()
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/api/ideas/c1/participants/viewer1')
    )
    alertSpy.mockRestore()
  })

  it('leaves the participant in place when the confirm is dismissed', async () => {
    respond(joinedDetail())
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Leave' }))
    expect(mockDelete).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('never offers the author a join button on their own challenge', async () => {
    mockUseCapabilities.mockReturnValue(viewer('author1'))
    respond(detail())
    render(<ChallengeDetailScreen id="c1" />)

    await screen.findByText('A switch a toddler can hit')
    expect(screen.queryByRole('button', { name: 'Join this challenge' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull()
  })

  it('asks a signed-out reader to sign in rather than to join', async () => {
    mockUseCapabilities.mockReturnValue(signedOut)
    render(<ChallengeDetailScreen id="c1" />)

    expect(
      await screen.findByText('Sign in to see the conversation and join this challenge.')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Join this challenge' })).toBeNull()
  })

  it('closes joining on a graduated challenge and points at the guide it became', async () => {
    mockGet.mockResolvedValue(detail({ status: 'graduated', tutorial_id: 'tut7' }))
    render(<ChallengeDetailScreen id="c1" />)

    expect(
      await screen.findByText('This challenge has moved on to write-up, so joining is no longer open.')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Join this challenge' })).toBeNull()

    fireEvent.press(screen.getByRole('button', { name: 'Read the guide' }))
    expect(mockPush).toHaveBeenCalledWith('/guides/tut7')
  })

  it('saves against the challenges slug', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Save' }))
    expect(mockToggle).toHaveBeenCalledWith('challenges', 'c1')
  })

  it("says it couldn't load rather than showing an empty brief", async () => {
    mockGet.mockRejectedValue(new Error('404'))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText("Couldn't load this challenge.")).toBeTruthy()
  })

  describe('the thread', () => {
    it('never asks for messages a non-participant may not read', async () => {
      respond(detail())
      render(<ChallengeDetailScreen id="c1" />)

      await screen.findByText('Join this challenge to read and take part in the conversation.')
      expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/c1/messages')
    })

    it('reads the conversation once you are in it', async () => {
      respond(joinedDetail(), [
        message({ id: 'm1', sender_id: 'author1', body: 'Has anyone tried a lever?' }),
        message({ id: 'm2', sender_id: 'viewer1', body: 'Printing one tonight.' }),
        message({ id: 'm3', kind: 'system', sender_id: 'viewer1', body: 'Viewer joined this challenge' }),
      ])
      render(<ChallengeDetailScreen id="c1" />)

      expect(await screen.findByLabelText('Priya said: Has anyone tried a lever?')).toBeTruthy()
      expect(screen.getByLabelText('You said: Printing one tonight.')).toBeTruthy()
      // A system line is the platform narrating, not a person speaking.
      expect(screen.getByText('Viewer joined this challenge')).toBeTruthy()
    })

    it('lets the author read the thread without joining their own challenge', async () => {
      mockUseCapabilities.mockReturnValue(viewer('author1'))
      respond(detail(), [message({ sender_id: 'author1', body: 'Thanks for looking.' })])
      render(<ChallengeDetailScreen id="c1" />)

      expect(await screen.findByLabelText('You said: Thanks for looking.')).toBeTruthy()
    })

    it('posts a message and shows it without waiting for the next poll', async () => {
      respond(joinedDetail(), [])
      mockPost.mockResolvedValue(message({ id: 'm9', sender_id: 'viewer1', body: 'On it.' }))
      render(<ChallengeDetailScreen id="c1" />)

      const composer = await screen.findByLabelText('Message this challenge')
      fireEvent.changeText(composer, '  On it.  ')
      fireEvent.press(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/messages', { body: 'On it.' })
      )
      expect(await screen.findByLabelText('You said: On it.')).toBeTruthy()
    })

    it('refuses to send an empty message', async () => {
      respond(joinedDetail(), [])
      render(<ChallengeDetailScreen id="c1" />)

      const send = await screen.findByRole('button', { name: 'Send' })
      fireEvent.changeText(screen.getByLabelText('Message this challenge'), '   ')
      fireEvent.press(send)
      expect(mockPost).not.toHaveBeenCalled()
      expect(send.props.accessibilityState).toMatchObject({ disabled: true })
    })

    it('keeps the draft when sending fails, and says so', async () => {
      respond(joinedDetail(), [])
      mockPost.mockRejectedValue(new Error('offline'))
      render(<ChallengeDetailScreen id="c1" />)

      fireEvent.changeText(await screen.findByLabelText('Message this challenge'), 'Kept')
      fireEvent.press(screen.getByRole('button', { name: 'Send' }))

      expect(await screen.findByText('Could not send that message. Please try again.')).toBeTruthy()
      expect(screen.getByLabelText('Message this challenge').props.value).toBe('Kept')
    })

    it('polls the thread while the screen is focused, and stops on unmount', async () => {
      jest.useFakeTimers()
      try {
        respond(joinedDetail(), [])
        const view = render(<ChallengeDetailScreen id="c1" />)
        await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/ideas/c1/messages'))

        const afterFirst = mockGet.mock.calls.filter((c) => c[0] === '/api/ideas/c1/messages').length
        await act(async () => {
          jest.advanceTimersByTime(10_000)
        })
        const afterPoll = mockGet.mock.calls.filter((c) => c[0] === '/api/ideas/c1/messages').length
        expect(afterPoll).toBeGreaterThan(afterFirst)

        view.unmount()
        await act(async () => {
          jest.advanceTimersByTime(30_000)
        })
        expect(
          mockGet.mock.calls.filter((c) => c[0] === '/api/ideas/c1/messages').length
        ).toBe(afterPoll)
      } finally {
        jest.useRealTimers()
      }
    })

    it('attributes a message from someone who has since left to nobody in particular', async () => {
      respond(joinedDetail(), [message({ sender_id: 'gone1', body: 'I tried a proximity switch.' })])
      render(<ChallengeDetailScreen id="c1" />)

      // Their participant row is gone, so the brief carries no name for them —
      // the message stays, unattributed, rather than being dropped.
      expect(await screen.findByLabelText('Someone said: I tried a proximity switch.')).toBeTruthy()
    })
  })
})
