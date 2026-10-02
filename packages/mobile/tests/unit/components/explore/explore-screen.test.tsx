// packages/mobile/tests/unit/components/explore/explore-screen.test.tsx
import { ScrollView, StyleSheet } from 'react-native'
import { theme } from '../../../../lib/theme'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'
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
    if (path === '/api/public/impact')
      return Promise.resolve({
        totals: { tutorials: 142, toysShared: 20, toysDelivered: 318, contributors: 57, organisations: 14 },
        recent: [],
        contributors: [],
        organisations: [],
        deliveriesByMonth: [],
      })
    return Promise.resolve([])
  })
})


// The page ground is the background token, and the scroll frame spans the
// Screen padding so it cannot clip the cards' shadows into a grey rectangle.
const groundOk = (root: any, frame: { props: { style?: unknown; contentContainerStyle?: unknown } }) => {
  const ground = StyleSheet.flatten(root.props.style) as { backgroundColor?: string }
  const f = StyleSheet.flatten(frame.props.style as object) as { marginHorizontal?: number }
  const c = StyleSheet.flatten(frame.props.contentContainerStyle as object) as { paddingHorizontal?: number }
  return ground.backgroundColor === theme.colors.background && f.marginHorizontal === -16 && c.paddingHorizontal === 16
}

describe('ExploreScreen as Home', () => {
  it('sits on the page ground, and leaves a 16 gap under the search field', async () => {
    render(<ExploreScreen variant="home" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(groundOk(screen.toJSON(), screen.UNSAFE_getByType(ScrollView))).toBe(true)
    const box = screen.getByTestId('search-box')
    expect((StyleSheet.flatten(box.props.style) as { marginBottom?: number }).marginBottom).toBeGreaterThanOrEqual(16)
  })

  it('pads its scroll content so the last row clears the floating tab bar', async () => {
    render(<ExploreScreen variant="home" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    const pad = (n: { props: { contentContainerStyle?: unknown } }) =>
      (StyleSheet.flatten(n.props.contentContainerStyle as object) as { paddingBottom?: number }).paddingBottom
    expect(pad(screen.UNSAFE_getByType(ScrollView))).toBe(tabBarClearance(0))
  })

  it('titles itself Home with no back button, and adds Guides and Toys doors', async () => {
    render(<ExploreScreen variant="home" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.getByText('Home')).toBeTruthy()
    expect(screen.queryByLabelText(/back/i)).toBeNull()
    fireEvent.press(screen.getByLabelText('Guides'))
    expect(mockPush).toHaveBeenCalledWith('/guides')
    fireEvent.press(screen.getByLabelText('Toys'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library')
    fireEvent.press(screen.getByLabelText('Learn'))
    expect(mockPush).toHaveBeenCalledWith('/explore/learn')
  })

  it('keeps the plain Explore free of the Home hero and the extra doors', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.queryByText('Home')).toBeNull()
    expect(screen.queryByLabelText('Guides')).toBeNull()
  })
})

describe('ExploreScreen', () => {
  it('fetches every source once on mount', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials')
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys')
    expect(mockGet).toHaveBeenCalledWith('/api/public/organizations')
    expect(mockGet).toHaveBeenCalledWith('/api/public/impact')
  })

  it("renders the board's seven doors with the Learn progress chip, and routes on press", async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.getByText(`2/${LEARN_ARTICLES.length}`)).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Learn'))
    expect(mockPush).toHaveBeenCalledWith('/explore/learn')

    fireEvent.press(screen.getByLabelText('Design challenges'))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges')

    // Every destination the old tinted doors had is still a door.
    fireEvent.press(screen.getByLabelText('Makers wanted'))
    expect(mockPush).toHaveBeenCalledWith('/explore/makers-wanted')
    fireEvent.press(screen.getByLabelText('Organisations'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisations')
    fireEvent.press(screen.getByLabelText('3D printing'))
    expect(mockPush).toHaveBeenCalledWith('/printing')
    fireEvent.press(screen.getByLabelText('Recycle plastic'))
    expect(mockPush).toHaveBeenCalledWith('/explore/recycling')

    fireEvent.press(screen.getByLabelText('About SPLAT'))
    expect(mockPush).toHaveBeenCalledWith('/explore/about')
  })

  it('hides results while the search query is blank', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.queryByText('Bubble machine guide')).toBeNull()
    expect(screen.queryByText('Switch car')).toBeNull()
    expect(screen.queryByText('TAD Australia')).toBeNull()
  })

  it('filters across guides, toys and organisations as you type, grouped under eyebrows', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    await screen.findByText('This community so far')

    fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys, organisations'), 'switch')

    expect(await screen.findByText('Switch car')).toBeTruthy()
    expect(screen.getByText('Toys')).toBeTruthy()
    expect(screen.queryByText('Bubble machine guide')).toBeNull()
    expect(screen.queryByText('TAD Australia')).toBeNull()
    // "Guides" and "Organisations" are also community totals, and
    // "Organisations" a door, so no eyebrow means only those.
    expect(screen.getAllByText('Guides')).toHaveLength(1)
    expect(screen.getAllByText('Organisations')).toHaveLength(2)
  })

  it('routes a search result to its detail screen on press', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))

    fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys, organisations'), 'switch')
    fireEvent.press(await screen.findByLabelText('Switch car'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  })

  it('clearing the query back to blank hides the results again', async () => {
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))

    const field = screen.getByPlaceholderText('Search guides, toys, organisations')
    fireEvent.changeText(field, 'switch')
    expect(await screen.findByText('Switch car')).toBeTruthy()

    fireEvent.changeText(field, '')
    expect(screen.queryByText('Switch car')).toBeNull()
  })

  it('still lists results from the sources that succeeded when one source fails, and shows a retry', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/api/public/tutorials') return Promise.reject(new Error('API GET failed with status 500'))
      if (path === '/api/public/toys') return Promise.resolve([{ id: 't1', name: 'Switch car' }])
      if (path === '/api/public/organizations') return Promise.resolve([{ id: 'o1', name: 'TAD Australia' }])
      return Promise.resolve([])
    })
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(await screen.findByText("Couldn't load everything — try again.")).toBeTruthy()

    fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys, organisations'), 'a')
    expect(screen.getByText('Switch car')).toBeTruthy()
    expect(screen.getByText('TAD Australia')).toBeTruthy()
    expect(screen.queryByText('Bubble machine guide')).toBeNull()
    expect(screen.queryByText('Guides')).toBeNull()
  })

  it('retrying refetches all three sources and clears the error once they all succeed', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/api/public/tutorials') return Promise.reject(new Error('API GET failed with status 500'))
      if (path === '/api/public/toys') return Promise.resolve([{ id: 't1', name: 'Switch car' }])
      if (path === '/api/public/organizations') return Promise.resolve([{ id: 'o1', name: 'TAD Australia' }])
      return Promise.resolve([])
    })
    render(<ExploreScreen />)
    await screen.findByText("Couldn't load everything — try again.")
    expect(mockGet).toHaveBeenCalledTimes(4)

    mockGet.mockImplementation((path: string) => {
      if (path === '/api/public/tutorials') return Promise.resolve([{ id: 'g1', title: 'Bubble machine guide' }])
      if (path === '/api/public/toys') return Promise.resolve([{ id: 't1', name: 'Switch car' }])
      if (path === '/api/public/organizations') return Promise.resolve([{ id: 'o1', name: 'TAD Australia' }])
      return Promise.resolve([])
    })
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(8))
    expect(screen.queryByText("Couldn't load everything — try again.")).toBeNull()
  })

  it("shows the community's four totals", async () => {
    render(<ExploreScreen />)
    expect(await screen.findByText('This community so far')).toBeTruthy()
    for (const [value, label] of [
      ['142', 'Guides'],
      ['318', 'Toys delivered'],
      ['57', 'Contributors'],
    ]) {
      expect(screen.getByText(value)).toBeTruthy()
      expect(screen.getByText(label)).toBeTruthy()
    }
    // "Organisations" is also a door title above, so it appears twice.
    expect(screen.getByText('14')).toBeTruthy()
    expect(screen.getAllByText('Organisations')).toHaveLength(2)
  })

  it('leaves the totals out, and says nothing, when the impact read fails', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/public/impact' ? Promise.reject(new Error('500')) : Promise.resolve([])
    )
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.queryByText('This community so far')).toBeNull()
    // The search sources succeeded, so the error row stays away too.
    expect(screen.queryByText(/Couldn.t load everything/)).toBeNull()
  })
})
