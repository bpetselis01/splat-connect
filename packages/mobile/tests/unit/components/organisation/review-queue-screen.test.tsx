// packages/mobile/tests/unit/components/organisation/review-queue-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ReviewQueueScreen } from '../../../../components/organisation/review-queue-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

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

const tutorial = (over: object) => ({
  id: 't1',
  title: 'Bubble machine',
  description: '',
  difficulty: 'easy',
  kind: 'toy_adaptation',
  status: 'draft',
  tutorial_pdf_url: null,
  photo_urls: [],
  toy_photo_url: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  tutorial_orgs: [],
  ...over,
})

const backing = (over: object) => ({
  id: 'b1',
  tutorial_id: 't1',
  org_id: 'org1',
  status: 'pending',
  requested_at: '2026-08-01T00:00:00Z',
  responded_at: null,
  responded_by: null,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(leader([{ id: 'org1', name: 'Riverside Therapy' }]))
  mockGet.mockResolvedValue([])
})

describe('ReviewQueueScreen', () => {
  it('waits on a pending backing request and on a submitted, backed guide alike', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 't1', title: 'Asked to back', tutorial_orgs: [backing({ status: 'pending' })] }),
      tutorial({
        id: 't2',
        title: 'Asked to review',
        status: 'pending',
        tutorial_orgs: [backing({ id: 'b2', tutorial_id: 't2', status: 'accepted' })],
      }),
    ])
    render(<ReviewQueueScreen />)

    expect(await screen.findByText('Waiting on you')).toBeTruthy()
    expect(screen.getByText('Asked to back')).toBeTruthy()
    expect(screen.getByText('Asked to review')).toBeTruthy()
  })

  it('keeps an accepted backing on a finished guide under Backed, not Waiting', async () => {
    mockGet.mockResolvedValue([
      tutorial({
        id: 't3',
        title: 'Already approved',
        status: 'approved',
        tutorial_orgs: [backing({ status: 'accepted' })],
      }),
    ])
    render(<ReviewQueueScreen />)

    expect(await screen.findByText('Backed')).toBeTruthy()
    expect(screen.getByText('Already approved')).toBeTruthy()
    expect(screen.queryByText('Waiting on you')).toBeNull()
  })

  it("ignores another organisation's rows entirely", async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 't4', title: 'Not ours', tutorial_orgs: [backing({ org_id: 'someone-else' })] }),
    ])
    render(<ReviewQueueScreen />)

    expect(await screen.findByText('Nothing waiting.')).toBeTruthy()
    expect(screen.queryByText('Not ours')).toBeNull()
  })

  it('orders the queue oldest first — a leader asks what is oldest', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'new', title: 'Newer ask', created_at: '2026-08-20T00:00:00Z', tutorial_orgs: [backing({ tutorial_id: 'new' })] }),
      tutorial({ id: 'old', title: 'Older ask', created_at: '2026-08-01T00:00:00Z', tutorial_orgs: [backing({ id: 'b9', tutorial_id: 'old' })] }),
    ])
    render(<ReviewQueueScreen />)

    await screen.findByText('Older ask')
    const rows = screen.getAllByRole('button')
    const labels = rows.map((r) => r.props.accessibilityLabel)
    expect(labels.indexOf('Older ask')).toBeLessThan(labels.indexOf('Newer ask'))
  })

  it('opens the review detail for a row', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 't1', title: 'Open me', tutorial_orgs: [backing({})] }),
    ])
    render(<ReviewQueueScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Open me' }))
    expect(mockPush).toHaveBeenCalledWith('/organisation/t1')
  })

  it('names the organisation on a row when the caller leads more than one', async () => {
    mockUseCapabilities.mockReturnValue(
      leader([
        { id: 'org1', name: 'Riverside Therapy' },
        { id: 'org2', name: 'Northside Makers' },
      ])
    )
    mockGet.mockResolvedValue([
      tutorial({ id: 't1', title: 'For Riverside', tutorial_orgs: [backing({ org_id: 'org1' })] }),
    ])
    render(<ReviewQueueScreen />)

    await screen.findByText('For Riverside')
    expect(screen.getByText('Riverside Therapy')).toBeTruthy()
  })

  it('explains itself to someone who leads no organisation', async () => {
    mockUseCapabilities.mockReturnValue(leader([]))
    render(<ReviewQueueScreen />)

    expect(await screen.findByText('This screen belongs to organisation leaders.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })
})
