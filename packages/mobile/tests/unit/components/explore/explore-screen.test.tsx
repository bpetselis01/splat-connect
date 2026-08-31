// packages/mobile/tests/unit/components/explore/explore-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ExploreScreen } from '../../../../components/explore/explore-screen'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as the
// rest of the suite.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => ({ count: 2 }) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/public/tutorials') return Promise.resolve([{ id: 'g1', title: 'Bubble machine guide' }])
    if (path === '/api/public/toys') return Promise.resolve([{ id: 't1', name: 'Switch car' }])
    if (path === '/api/public/organizations') return Promise.resolve([{ id: 'o1', name: 'TAD Australia' }])
    return Promise.resolve([])
  })
})

describe('ExploreScreen', () => {
  it('fetches every source once on mount', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials')
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys')
    expect(mockGet).toHaveBeenCalledWith('/api/public/organizations')
  })

  it('renders the three doors with the Learn progress chip, and routes on press', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.getByText(`2/${LEARN_ARTICLES.length}`)).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Learn'))
    expect(mockPush).toHaveBeenCalledWith('/explore/learn')

    fireEvent.press(screen.getByLabelText('Get Involved'))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges')

    fireEvent.press(screen.getByLabelText('About SPLAT'))
    expect(mockPush).toHaveBeenCalledWith('/explore/about')
  })

  it('hides results while the search query is blank', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.queryByText('Bubble machine guide')).toBeNull()
    expect(screen.queryByText('Switch car')).toBeNull()
    expect(screen.queryByText('TAD Australia')).toBeNull()
  })

  it('filters across guides, toys and organisations as you type, grouped under eyebrows', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))

    fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys and organisations'), 'switch')

    expect(await screen.findByText('Switch car')).toBeTruthy()
    expect(screen.getByText('Toys')).toBeTruthy()
    expect(screen.queryByText('Bubble machine guide')).toBeNull()
    expect(screen.queryByText('TAD Australia')).toBeNull()
    expect(screen.queryByText('Guides')).toBeNull()
    expect(screen.queryByText('Organisations')).toBeNull()
  })

  it('routes a search result to its detail screen on press', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))

    fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys and organisations'), 'switch')
    fireEvent.press(await screen.findByLabelText('Switch car'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  })

  it('clearing the query back to blank hides the results again', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))

    const field = screen.getByPlaceholderText('Search guides, toys and organisations')
    fireEvent.changeText(field, 'switch')
    expect(await screen.findByText('Switch car')).toBeTruthy()

    fireEvent.changeText(field, '')
    expect(screen.queryByText('Switch car')).toBeNull()
  })
})
