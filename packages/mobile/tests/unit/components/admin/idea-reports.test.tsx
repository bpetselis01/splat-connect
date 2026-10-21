import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MemberReportsScreen } from '../../../../components/admin/member-reports-screen'
import { IdeaReportDetailScreen } from '../../../../components/admin/idea-report-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
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

const idea = (over: Record<string, unknown> = {}) => ({
  id: 'ir1', idea_id: 'i1', reported_profile_id: 'p1', reason: 'Rude in the thread.', created_at: '2026-10-01T00:00:00Z',
  resolved_at: null, resolution_note: null, removed: false,
  toy_ideas: { title: 'Ladybug switch' }, reported_profile: { name: 'Sam' }, reporter: { name: 'Priya' }, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPatch.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/admin/reports' ? [idea(), idea({ id: 'ir2', resolved_at: '2026-10-02T00:00:00Z', removed: true })] : []),
  )
})

describe('Idea reports tab', () => {
  it('Q40 Q41 lists open idea reports, counts both stages, and opens one', async () => {
    render(<MemberReportsScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Idea reports' }))
    fireEvent.press(await screen.findByRole('button', { name: /Sam in Ladybug switch/ }))
    expect(mockPush).toHaveBeenCalledWith('/admin/reports/idea/ir1')
    expect(screen.getByRole('button', { name: 'Resolved, 1' })).toBeTruthy()
  })

  it('shows an EmptyState when there are none', async () => {
    mockGet.mockResolvedValue([])
    render(<MemberReportsScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Idea reports' }))
    expect(await screen.findByText('No open idea reports.')).toBeTruthy()
  })
})

describe('IdeaReportDetailScreen', () => {
  it('Q45 Remove sends the action with the trimmed note', async () => {
    render(<IdeaReportDetailScreen reportId="ir1" />)
    fireEvent.changeText(await screen.findByLabelText('Note for the record'), '  Warned twice. ')
    fireEvent.press(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/reports/ir1', { action: 'remove', resolution_note: 'Warned twice.' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('Q44 Dismiss sends the dismiss action', async () => {
    render(<IdeaReportDetailScreen reportId="ir1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/reports/ir1', { action: 'dismiss', resolution_note: '' }))
  })

  it('Q46 a resolved report with a removed person offers only Reinstate', async () => {
    render(<IdeaReportDetailScreen reportId="ir2" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Reinstate' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/admin/ideas/i1/participants/p1/removal'))
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })
})
