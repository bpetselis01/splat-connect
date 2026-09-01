// packages/mobile/tests/unit/components/saved/saved-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SavedScreen } from '../../../../components/saved/saved-screen'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ tutorials: [], toys: [], challenges: [] })
})

describe('SavedScreen', () => {
  it('counts each type on its tile', async () => {
    mockGet.mockResolvedValue({ tutorials: ['t1', 't2'], toys: ['y1'], challenges: [] })
    render(<SavedScreen />)

    expect(await screen.findByText('Guides')).toBeTruthy()
    const tiles = screen.getAllByRole('button')
    expect(screen.getByRole('button', { name: 'Guides' }).props.accessibilityHint).toContain('2 saved')
    expect(screen.getByRole('button', { name: 'Toys' }).props.accessibilityHint).toContain('1 saved')
    expect(screen.getByRole('button', { name: 'Challenges' }).props.accessibilityHint).toContain('Nothing saved')
    expect(tiles.length).toBeGreaterThanOrEqual(3)
    expect(mockGet).toHaveBeenCalledWith('/api/saves/ids')
  })

  it('opens each type list', async () => {
    render(<SavedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Guides' }))
    expect(mockPush).toHaveBeenCalledWith('/saved/tutorials')
    fireEvent.press(screen.getByRole('button', { name: 'Toys' }))
    expect(mockPush).toHaveBeenCalledWith('/saved/toys')
    fireEvent.press(screen.getByRole('button', { name: 'Challenges' }))
    expect(mockPush).toHaveBeenCalledWith('/saved/challenges')
  })

  it('offers a retry when the counts fail, and recovers on it', async () => {
    mockGet.mockRejectedValue(new Error('down'))
    render(<SavedScreen />)

    expect(await screen.findByText("Couldn't load what you've saved.")).toBeTruthy()

    mockGet.mockResolvedValue({ tutorials: ['t1'], toys: [], challenges: [] })
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guides' }).props.accessibilityHint).toContain('1 saved')
    )
  })
})
