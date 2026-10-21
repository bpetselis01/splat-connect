import { render, screen, fireEvent } from '@testing-library/react-native'
import { SpotCheckScreen } from '../../../../components/admin/spot-check-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('SpotCheckScreen', () => {
  it('Q47 Q48 lists the sample and opens a guide on the admin review route', async () => {
    mockGet.mockResolvedValue([
      {
        id: 't1', title: 'Bubble machine', toy_photo_url: null, reviewed_at: '2026-09-01T00:00:00Z',
        tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'Riverside' } }],
      },
    ])
    render(<SpotCheckScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Bubble machine/ }))
    expect(mockGet).toHaveBeenCalledWith('/api/admin/spot-check')
    expect(screen.getByText(/Approved for Riverside/)).toBeTruthy()
    expect(mockPush).toHaveBeenCalledWith('/admin/review/t1')
  })

  it('shows an EmptyState when there is nothing to check', async () => {
    mockGet.mockResolvedValue([])
    render(<SpotCheckScreen />)
    expect(await screen.findByText('Nothing to check yet.')).toBeTruthy()
  })
})
