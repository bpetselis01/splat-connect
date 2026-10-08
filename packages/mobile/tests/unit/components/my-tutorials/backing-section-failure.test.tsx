// The guide editor's Backing section when its read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: T18 T19
import { render, screen, fireEvent } from '@testing-library/react-native'
import { BackingSection } from '../../../../components/my-tutorials/sections/backing-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), delete: jest.fn() } }))
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => ({ tutorial: { id: 't1', status: 'draft', reviewed_for_org_id: null } }) }))

afterEach(() => jest.restoreAllMocks())

it('says backing could not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation(() => (offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])))
  render(<BackingSection />)
  expect(await screen.findByText(/Could not load backing/)).toBeTruthy()
  expect(screen.getByText(/Check your connection and try again/)).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(/No organisation is backing/)).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
