import { render, screen, fireEvent } from '@testing-library/react-native'
import { SpotCheckScreen } from '../../../../components/admin/spot-check-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('SpotCheckScreen failures', () => {
  it('shows "Admins only" on a 403', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<SpotCheckScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('offline: says so, logs nothing, and Try again fetches it again', async () => {
    mockGet.mockReset()
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<SpotCheckScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
    mockGet.mockResolvedValue([{ id: 't1', title: 'Back again', toy_photo_url: null, reviewed_at: null }])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back again')).toBeTruthy()
  })
})
