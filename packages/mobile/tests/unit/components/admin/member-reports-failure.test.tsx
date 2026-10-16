import { render, screen, fireEvent } from '@testing-library/react-native'
import { MemberReportsScreen } from '../../../../components/admin/member-reports-screen'
import { MemberReportDetailScreen } from '../../../../components/admin/member-report-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn(), back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })
const row = {
  id: 'r1', subject_kind: 'guide', subject_label: 'Guide: Ladybug', category: 'safety', body: 'Loose cover.',
  ok_to_contact: false, status: 'new', note_to_reporter: null, reporter_name: null, created_at: '2026-10-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('member reports failures', () => {
  it('shows "Admins only" when the list is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<MemberReportsScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows "Admins only" on the opened report when the read is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<MemberReportDetailScreen reportId="r1" />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows a retry when the list cannot load', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(<MemberReportsScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
  })

  it('shows the server sentence word for word and stays on the report', async () => {
    mockGet.mockResolvedValue([row])
    mockPatch.mockRejectedValue(new Error('PATCH failed with status 400: That note is too long.'))
    render(<MemberReportDetailScreen reportId="r1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Resolve' }))
    expect(await screen.findByText('That note is too long.')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('says so when the report is gone', async () => {
    mockGet.mockResolvedValue([])
    render(<MemberReportDetailScreen reportId="r1" />)
    expect(await screen.findByText("That report isn't here any more.")).toBeTruthy()
  })
})
