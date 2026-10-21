import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyReportsScreen } from '../../../../components/me/my-reports-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const report = (over: Record<string, unknown> = {}) => ({
  id: 'r1', subject_kind: 'guide', subject_label: 'Guide: Ladybug', subject_id: null, category: 'safety', body: 'Loose cover.',
  ok_to_contact: true, status: 'new', note_to_reporter: null, created_at: '2026-10-01T00:00:00Z', ...over,
})

beforeEach(() => jest.clearAllMocks())

describe('MyReportsScreen', () => {
  it('Q21 lists each report with its status and the note SPLAT sent back', async () => {
    mockGet.mockResolvedValue([
      report({ status: 'resolved', note_to_reporter: 'We added a screw-down cover.' }),
      report({ id: 'r2', subject_label: 'Toy: Frog', status: 'looking', category: 'other' }),
    ])
    render(<MyReportsScreen />)
    expect(await screen.findByText('Guide: Ladybug')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/reports')
    expect(screen.getByText('Resolved')).toBeTruthy()
    expect(screen.getByText('Being looked at')).toBeTruthy()
    expect(screen.getByText('We added a screw-down cover.')).toBeTruthy()
  })

  it('shows an EmptyState when nothing was reported', async () => {
    mockGet.mockResolvedValue([])
    render(<MyReportsScreen />)
    expect(await screen.findByText('No reports yet')).toBeTruthy()
  })
})
