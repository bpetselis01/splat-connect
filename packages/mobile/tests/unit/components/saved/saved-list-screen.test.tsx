// packages/mobile/tests/unit/components/saved/saved-list-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SavedListScreen } from '../../../../components/saved/saved-list-screen'

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

const mockToggle = jest.fn()
const mockIsSaved = jest.fn(() => true)
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({
    savedIds: { tutorials: [], toys: [], challenges: [] },
    isSaved: (...a: unknown[]) => mockIsSaved(...(a as [])),
    toggle: mockToggle,
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
})

describe('SavedListScreen', () => {
  it('lists saved guides and opens one', async () => {
    mockGet.mockResolvedValue([
      { id: 't1', title: 'Bubble machine', difficulty: 'easy', kind: 'toy_adaptation' },
    ])
    render(<SavedListScreen slug="tutorials" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Bubble machine' }))
    expect(mockPush).toHaveBeenCalledWith('/guides/t1')
    expect(mockGet).toHaveBeenCalledWith('/api/saves/tutorials')
  })

  it('lists saved toys under their own name field and route', async () => {
    mockGet.mockResolvedValue([
      { id: 'y1', name: 'Switch car', condition: 8, profiles: { name: 'Jamie' }, organizations: null },
    ])
    render(<SavedListScreen slug="toys" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Switch car' }))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/y1')
  })

  it('lists saved challenges and opens the brief', async () => {
    mockGet.mockResolvedValue([{ id: 'c1', title: 'A softer switch', summary: 'Too stiff.' }])
    render(<SavedListScreen slug="challenges" />)

    fireEvent.press(await screen.findByRole('button', { name: 'A softer switch' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/c1')
  })

  it('unsaves in place through the bookmark', async () => {
    mockGet.mockResolvedValue([{ id: 't1', title: 'Bubble machine' }])
    render(<SavedListScreen slug="tutorials" />)

    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByRole('button', { name: 'Saved' }))
    expect(mockToggle).toHaveBeenCalledWith('tutorials', 't1')
  })

  it('points an empty list back at where these things live', async () => {
    render(<SavedListScreen slug="toys" />)
    expect(await screen.findByText('Nothing saved here yet.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Browse the toy library' }))
    expect(mockPush).toHaveBeenCalledWith('/toy-library')
  })

  it('says so when the list cannot load, with a retry', async () => {
    mockGet.mockRejectedValue(new Error('down'))
    render(<SavedListScreen slug="tutorials" />)

    expect(await screen.findByText("Couldn't load your saved guides.")).toBeTruthy()
    mockGet.mockResolvedValue([{ id: 't1', title: 'Back online' }])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back online')).toBeTruthy()
  })
})
