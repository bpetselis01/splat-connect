// Explore when its search sources fail: says so, Try again re-reads, nothing hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ExploreScreen } from '../../../../components/explore/explore-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => ({ count: 0 }) }))

afterEach(() => jest.restoreAllMocks())

it('Q13 says it could not load offline, and Try again loads the searchable lists', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((p: string) => {
    if (offline) return Promise.reject(new Error('Network request failed'))
    return p === '/api/public/tutorials' ? Promise.resolve([{ id: 'g1', title: 'Bubble machine' }]) : p === '/api/public/impact' ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])
  })
  render(<ExploreScreen />)
  expect(await screen.findByText("Couldn't load everything — try again.")).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys, organisations'), 'bubble')
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(screen.queryByText("Couldn't load everything — try again.")).toBeNull()
  expect(err).not.toHaveBeenCalled()
})
