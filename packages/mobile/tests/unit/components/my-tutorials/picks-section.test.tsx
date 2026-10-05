import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PicksSection } from '../../../../components/my-tutorials/sections/picks-section'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))

const rec = (id: string, title: string, status = 'approved') => ({
  position: 1,
  tutorials: { id, title, kind: 'toy_adaptation', status },
})
const base = { id: 't1', status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [] }
const mockDraft = {
  tutorial: { ...base } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null,
  save: jest.fn(), saveNow: jest.fn(), flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const guide = (id: string, title: string) => ({ id, title, kind: 'assistive_tech' })

beforeEach(() => {
  jest.clearAllMocks()
  mockDraft.tutorial = { ...base, tutorial_recommendations: [rec('a', 'Guide A')] }
  ;(apiClient.get as jest.Mock).mockResolvedValue([guide('t1', 'Itself'), guide('a', 'Guide A'), guide('b', 'Guide B')])
  ;(apiClient.post as jest.Mock).mockResolvedValue([])
})

it('lists picks and offers approved guides, minus itself and what is already picked', async () => {
  render(<PicksSection />)
  expect(screen.getByText('Guide A')).toBeTruthy()
  await screen.findByText('Guide B')
  expect(screen.queryByText('Itself')).toBeNull()
  expect(screen.getAllByText('Guide A')).toHaveLength(1)
})

it('adds a guide by replacing the whole list', async () => {
  render(<PicksSection />)
  fireEvent.press(await screen.findByLabelText('Add Guide B'))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith('/api/tutorials/t1/recommendations', {
      recommendations: [{ recommended_id: 'a' }, { recommended_id: 'b' }],
    })
  )
  expect(await screen.findByLabelText('Remove Guide B')).toBeTruthy()
})

it('removes a pick, and flags one that is not approved', async () => {
  mockDraft.tutorial = { ...base, tutorial_recommendations: [rec('a', 'Guide A', 'pending')] }
  render(<PicksSection />)
  expect(screen.getByText(/not yet approved/)).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Remove Guide A'))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith('/api/tutorials/t1/recommendations', { recommendations: [] })
  )
})

it('stops offering guides at three picks', async () => {
  mockDraft.tutorial = { ...base, tutorial_recommendations: ['a', 'c', 'd'].map((i) => rec(i, `G${i}`)) }
  render(<PicksSection />)
  await waitFor(() => expect(apiClient.get).toHaveBeenCalled())
  expect(screen.queryByText('Add a guide')).toBeNull()
})

it('shows the API sentence when the write is refused', async () => {
  ;(apiClient.post as jest.Mock).mockRejectedValue(new Error('nope'))
  render(<PicksSection />)
  fireEvent.press(await screen.findByLabelText('Add Guide B'))
  expect(await screen.findByText(/did not work|nope/)).toBeTruthy()
})
