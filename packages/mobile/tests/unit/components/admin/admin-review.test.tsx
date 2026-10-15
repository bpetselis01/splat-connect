// journeys: Q18 Q19
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AdminReviewQueueScreen } from '../../../../components/admin/admin-review-queue-screen'
import { ReviewDetailScreen } from '../../../../components/organisation/review-detail-screen'

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
  return {
    useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: jest.fn() }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: jest.fn() }) } } }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'a1', name: 'Ada' }, isAdmin: true, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })

const detail = {
  id: 't1', title: 'Bubble machine', description: 'Switch-adapt a bubble machine.', difficulty: 'easy', kind: 'toy_adaptation',
  status: 'pending', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  parts: [], tools: [], stl_files: [], tutorial_contributors: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPatch.mockResolvedValue({})
  mockGet.mockImplementation((path: string) =>
    path === '/api/tutorials/t1' ? Promise.resolve(detail) : Promise.reject(new Error(`unexpected GET ${path}`))
  )
})

describe('AdminReviewQueueScreen', () => {
  it('lists pending guides and opens one on /admin/review/:id', async () => {
    mockGet.mockResolvedValue([
      { ...detail, tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'Riverside' } }] },
    ])
    render(<AdminReviewQueueScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Bubble machine/ }))
    expect(mockGet).toHaveBeenCalledWith('/api/admin/tutorials?status=pending')
    expect(screen.getByText(/Riverside accepted/)).toBeTruthy()
    expect(mockPush).toHaveBeenCalledWith('/admin/review/t1')
  })

  it('shows an empty state when nothing is pending', async () => {
    mockGet.mockResolvedValue([])
    render(<AdminReviewQueueScreen />)
    expect(await screen.findByText('Nothing waiting.')).toBeTruthy()
  })

  it('shows "Admins only" on a 403', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<AdminReviewQueueScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })
})

describe('ReviewDetailScreen in admin mode', () => {
  it('approve PATCHes the admin status route with approved', async () => {
    render(<ReviewDetailScreen tutorialId="t1" admin />)
    fireEvent.press(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'approved', rejection_note: undefined })
    )
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockGet).not.toHaveBeenCalledWith('/api/tutorials/t1/orgs')
  })

  it('blocks Request changes without a note, then sends rejected with it', async () => {
    render(<ReviewDetailScreen tutorialId="t1" admin />)
    fireEvent.press(await screen.findByRole('button', { name: 'Request changes' }))
    expect(await screen.findByText(/Say what needs to change/)).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()

    fireEvent.changeText(screen.getByLabelText('Note to the contributor'), '  Add a parts list  ')
    fireEvent.press(screen.getByRole('button', { name: 'Request changes' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: 'Add a parts list' })
    )
  })

  it('shows "Admins only" when the guide read is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<ReviewDetailScreen tutorialId="t1" admin />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows "Admins only" when the decision is forbidden', async () => {
    mockPatch.mockRejectedValue(forbidden)
    render(<ReviewDetailScreen tutorialId="t1" admin />)
    fireEvent.press(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Admins only.')).toBeTruthy()
  })
})
