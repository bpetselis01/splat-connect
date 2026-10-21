// A failed ideas load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyChallengesScreen } from '../../../../components/challenges/my-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches both lists', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation(() => (down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])))
  render(<MyChallengesScreen />)
  expect(await screen.findByText('Could not load your ideas.')).toBeTruthy()
  down = false
  fireEvent.press(screen.getAllByText('Try again')[0])
  expect(await screen.findByText("You haven't submitted an idea yet.")).toBeTruthy()
  expect(screen.queryByText('Could not load your ideas.')).toBeNull()
  expect(errSpy).not.toHaveBeenCalled()
})
