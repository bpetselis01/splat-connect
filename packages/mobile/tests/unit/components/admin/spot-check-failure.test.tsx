import { render, screen } from '@testing-library/react-native'
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

describe('SpotCheckScreen failures', () => {
  it('shows "Admins only" on a 403', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<SpotCheckScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('offers a retry when the sample cannot load', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(<SpotCheckScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
  })
})
