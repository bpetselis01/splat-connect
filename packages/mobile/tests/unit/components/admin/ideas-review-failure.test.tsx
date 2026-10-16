import { render, screen, fireEvent } from '@testing-library/react-native'
import { IdeasReviewScreen } from '../../../../components/admin/ideas-review-screen'
import { IdeaReviewDetailScreen } from '../../../../components/admin/idea-review-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn() },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn(), back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })
const live = {
  id: 'i2', author_id: 'a1', title: 'Live one', summary: 's', description: null, intended_use: null, primary_user: null, contact_prefs: [],
  status: 'challenge', review_note: null, tutorial_id: null, kind: 'challenge', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', profiles: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ideas review failures', () => {
  it('shows "Admins only" when the list is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<IdeasReviewScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows "Admins only" on the idea when the read is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<IdeaReviewDetailScreen ideaId="i2" />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows a graduate 409 word for word and stays on the idea', async () => {
    mockGet.mockResolvedValue([live])
    mockPost.mockRejectedValue(new Error('POST failed with status 409: Already graduated'))
    render(<IdeaReviewDetailScreen ideaId="i2" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Graduate to draft' }))
    expect(await screen.findByText('Already graduated')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('shows "Admins only." when a decision is forbidden', async () => {
    mockGet.mockResolvedValue([live])
    mockPost.mockRejectedValue(Object.assign(new Error('POST failed with status 403: Forbidden'), { status: 403 }))
    render(<IdeaReviewDetailScreen ideaId="i2" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Graduate to draft' }))
    expect(await screen.findByText('Admins only.')).toBeTruthy()
  })

  it('offline: says so, logs nothing, and Try again fetches it again', async () => {
    mockGet.mockReset()
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<IdeasReviewScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
    mockGet.mockResolvedValue([{ ...live, status: 'pending', title: 'Back again' }])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back again')).toBeTruthy()
  })
})
