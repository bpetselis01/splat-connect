// A failed load of the story being edited says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { EditStoryScreen } from '../../../../components/organisation/story-form-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }) }))

const STORY = { id: 's1', kind: 'family', title: 'Leo drum', summary: 'S', body: 'B', byline: 'Northside', status: 'draft' }


it('editing a story offline: says so, Try again re-fetches and opens the form', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation(() => (down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([STORY])))
  render(<EditStoryScreen storyId="s1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByDisplayValue('Leo drum')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
