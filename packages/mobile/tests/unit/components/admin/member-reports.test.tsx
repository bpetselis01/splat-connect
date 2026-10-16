import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MemberReportsScreen } from '../../../../components/admin/member-reports-screen'
import { MemberReportDetailScreen } from '../../../../components/admin/member-report-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
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

const report = (over: Record<string, unknown> = {}) => ({
  id: 'r1', subject_kind: 'guide', subject_label: 'Guide: Ladybug', category: 'safety', body: 'The battery cover pulls off.',
  ok_to_contact: true, status: 'new', note_to_reporter: null, reporter_name: 'Priya N.', created_at: '2026-10-01T00:00:00Z', ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPatch.mockResolvedValue({})
  mockGet.mockResolvedValue([report(), report({ id: 'r2', status: 'resolved', subject_label: 'Toy: Frog' })])
})

describe('MemberReportsScreen', () => {
  it('lists the new reports with their counts and opens one', async () => {
    render(<MemberReportsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Guide: Ladybug/ }))
    expect(mockGet).toHaveBeenCalledWith('/api/admin/member-reports')
    expect(mockPush).toHaveBeenCalledWith('/admin/reports/r1')
    expect(screen.getByRole('button', { name: 'Resolved, 1' })).toBeTruthy()
    expect(screen.queryByText('Toy: Frog')).toBeNull()
  })

  it('shows an EmptyState when nothing is at that status', async () => {
    mockGet.mockResolvedValue([])
    render(<MemberReportsScreen />)
    expect(await screen.findByText('No new reports.')).toBeTruthy()
  })
})

describe('MemberReportDetailScreen', () => {
  it('resolving sends the status and the note', async () => {
    render(<MemberReportDetailScreen reportId="r1" />)
    fireEvent.changeText(await screen.findByLabelText('Note to the reporter'), '  We fixed it.  ')
    fireEvent.press(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/member-reports/r1', { status: 'resolved', note_to_reporter: 'We fixed it.' })
    )
    expect(mockBack).toHaveBeenCalled()
  })

  it('"Looking into it" sends the looking status', async () => {
    render(<MemberReportDetailScreen reportId="r1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Looking into it' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/member-reports/r1', { status: 'looking', note_to_reporter: '' })
    )
  })

  it('offers only "Save note" on a resolved report', async () => {
    render(<MemberReportDetailScreen reportId="r2" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/member-reports/r2', { note_to_reporter: '' }))
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
  })
})
