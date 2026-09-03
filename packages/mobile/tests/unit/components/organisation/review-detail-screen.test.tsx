// packages/mobile/tests/unit/components/organisation/review-detail-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReviewDetailScreen } from '../../../../components/organisation/review-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

// The preview signs storage paths through the live supabase client; stubbed
// the same way guides' own tests stub it.
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null }) }) } },
}))

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const leader = (orgs: { id: string; name: string }[]) => ({
  caps: {
    profile: { id: 'leader1', name: 'Lee', role: 'contributor' },
    isAdmin: false,
    ledOrgs: orgs,
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})

/** Answers the detail and its backings separately, in whatever order. */
function respond(brief: object, orgs: unknown[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/tutorials/t1') return Promise.resolve(brief)
    if (path === '/api/tutorials/t1/orgs') return Promise.resolve(orgs)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

const pendingBacking = { id: 'b1', tutorial_id: 't1', org_id: 'org1', status: 'pending', requested_at: '', responded_at: null, responded_by: null }
const acceptedBacking = { ...pendingBacking, status: 'accepted' }

const detail = (over: object = {}) => ({
  id: 't1',
  title: 'Bubble machine',
  description: 'Switch-adapt a bubble machine.',
  difficulty: 'easy',
  kind: 'toy_adaptation',
  status: 'draft',
  tutorial_pdf_url: 't1/tutorial.pdf',
  photo_urls: [],
  toy_photo_url: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  parts: [{ id: 'p1' }, { id: 'p2' }],
  tools: [{ id: 'tool1' }],
  stl_files: [],
  tutorial_contributors: [{ profile_id: 'author1', role: 'primary', profiles: { id: 'author1', name: 'Sam' } }],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(leader([{ id: 'org1', name: 'Riverside Therapy' }]))
  respond(detail(), [pendingBacking])
  mockPost.mockResolvedValue({})
})

describe('ReviewDetailScreen', () => {
  it('shows the brief and the check rows', async () => {
    render(<ReviewDetailScreen tutorialId="t1" />)

    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('Switch-adapt a bubble machine.')).toBeTruthy()
    expect(screen.getByText('By Sam')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the tutorial PDF' })).toBeTruthy()
    expect(screen.getByText('2 parts · 1 tool')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/tutorials/t1')
  })

  it('offers Back and Decline on a pending backing request', async () => {
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Back this guide' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/orgs/org1/accept', {})
    )
  })

  it('declines through its own route', async () => {
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/orgs/org1/decline', {})
    )
  })

  it('offers Approve and Request changes once backing is accepted and the guide is submitted', async () => {
    respond(detail({ status: 'pending' }), [acceptedBacking])
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/review', {
        status: 'approved',
        org_id: 'org1',
      })
    )
  })

  it('refuses Request changes without a note, before spending the round trip', async () => {
    respond(detail({ status: 'pending' }), [acceptedBacking])
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Request changes' }))
    expect(await screen.findByText('Say what needs to change — the note goes to the contributor.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends the note with a rejection', async () => {
    respond(detail({ status: 'pending' }), [acceptedBacking])
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.changeText(
      await screen.findByLabelText('Note to the contributor'),
      'The parts list is missing quantities.'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Request changes' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/review', {
        status: 'rejected',
        org_id: 'org1',
        rejection_note: 'The parts list is missing quantities.',
      })
    )
  })

  it('shows no actions at all once there is nothing for this leader to do', async () => {
    respond(detail({ status: 'approved' }), [acceptedBacking])
    render(<ReviewDetailScreen tutorialId="t1" />)

    await screen.findByText('Bubble machine')
    expect(screen.queryByRole('button', { name: 'Back this guide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it("surfaces the API's own sentence when an action fails", async () => {
    mockPost.mockRejectedValue(
      new Error('API POST /api/tutorials/t1/orgs/org1/accept failed with status 409: This request was already answered')
    )
    render(<ReviewDetailScreen tutorialId="t1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Back this guide' }))
    expect(await screen.findByText('This request was already answered')).toBeTruthy()
  })

  it('refetches after an action, so the actions follow the new state', async () => {
    render(<ReviewDetailScreen tutorialId="t1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Back this guide' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    // Initial load + post-action reload.
    await waitFor(() =>
      expect(mockGet.mock.calls.filter((c) => c[0] === '/api/tutorials/t1').length).toBeGreaterThan(1)
    )
  })
})
