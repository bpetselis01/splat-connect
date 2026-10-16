import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyReportsScreen } from '../../../../components/me/my-reports-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const report = () => ({
  id: 'r1', subject_kind: 'guide', subject_label: 'Guide: Ladybug', subject_id: null, category: 'safety', body: 'Loose cover.',
  ok_to_contact: true, status: 'new', note_to_reporter: null, created_at: '2026-10-01T00:00:00Z',
})

describe('MyReportsScreen failures', () => {
  it('offline: says so and Try again loads the list', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue([report()])
    render(<MyReportsScreen />)
    expect(await screen.findByText("Couldn't load your reports.")).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Guide: Ladybug')).toBeTruthy()
  })
})
