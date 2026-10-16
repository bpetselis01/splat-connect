import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { IdeasReviewScreen } from '../../../../components/admin/ideas-review-screen'
import { IdeaReviewDetailScreen } from '../../../../components/admin/idea-review-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush, back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const idea = (over: Record<string, unknown> = {}) => ({
  id: 'i1', author_id: 'a1', title: 'Switch bubble blower', summary: 'A big switch for bubbles.', description: null, intended_use: null,
  primary_user: null, contact_prefs: [], status: 'pending', review_note: null, tutorial_id: null, kind: 'challenge',
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', profiles: { name: 'Sam' }, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPatch.mockResolvedValue({})
  mockPost.mockResolvedValue({ tutorial_id: 't1' })
  mockGet.mockResolvedValue([idea(), idea({ id: 'i2', status: 'challenge', title: 'Live one' })])
})

describe('IdeasReviewScreen', () => {
  it('lists pending ideas first and opens one', async () => {
    render(<IdeasReviewScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Switch bubble blower/ }))
    expect(mockPush).toHaveBeenCalledWith('/admin/ideas/i1')
    expect(screen.queryByText('Live one')).toBeNull()
  })

  it('shows an EmptyState when no idea is pending', async () => {
    mockGet.mockResolvedValue([])
    render(<IdeasReviewScreen />)
    expect(await screen.findByText('No ideas waiting.')).toBeTruthy()
  })
})

describe('IdeaReviewDetailScreen', () => {
  it('rejecting without a note is blocked, then sends the note', async () => {
    render(<IdeaReviewDetailScreen ideaId="i1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('Say why. The author sees this note.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()

    fireEvent.changeText(screen.getByLabelText('Reason for rejecting'), '  Too close to an existing one  ')
    fireEvent.press(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/ideas/i1/status', { status: 'rejected', review_note: 'Too close to an existing one' })
    )
  })

  it('publishes a pending idea as a challenge', async () => {
    render(<IdeaReviewDetailScreen ideaId="i1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/ideas/i1/status', { status: 'challenge' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('graduates a published challenge', async () => {
    render(<IdeaReviewDetailScreen ideaId="i2" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Graduate to draft' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/admin/ideas/i2/graduate', {}))
  })

  it('offers no graduate on a question', async () => {
    mockGet.mockResolvedValue([idea({ id: 'q1', status: 'challenge', kind: 'question' })])
    render(<IdeaReviewDetailScreen ideaId="q1" />)
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Graduate to draft' })).toBeNull()
  })
})
