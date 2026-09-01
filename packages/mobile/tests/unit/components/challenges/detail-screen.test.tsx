// packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

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
    mockPost.mockResolvedValue({ joined: true })
    mockGet
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(detail({ participants: [{ profile_id: 'viewer1', name: 'Viewer' }] }))
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
    mockGet.mockResolvedValue(detail({ participants: [{ profile_id: 'viewer1', name: 'Viewer' }] }))
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
    mockGet.mockResolvedValue(detail({ participants: [{ profile_id: 'viewer1', name: 'Viewer' }] }))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<ChallengeDetailScreen id="c1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Leave' }))
    expect(mockDelete).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('never offers the author a join button on their own challenge', async () => {
    mockUseCapabilities.mockReturnValue(viewer('author1'))
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
})
