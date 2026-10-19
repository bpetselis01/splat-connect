// The challenge board when its read fails: says so, Try again re-reads, nothing hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChallengesListScreen } from '../../../../components/challenges/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, loading: false, refresh: jest.fn() }) }))

const row = {
  id: 'a', title: 'Challenge a', summary: 'Summary a', contact_prefs: [], status: 'challenge', kind: 'challenge',
  answered_at: null, maker_count: 0, answer_count: 0, created_at: '2026-08-01T00:00:00Z',
}

afterEach(() => jest.restoreAllMocks())

it('C01 says the challenges could not load offline, and Try again loads them', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation(() => (offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve([row])))
  render(<ChallengesListScreen />)
  expect(await screen.findByText("Couldn't load design challenges.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Challenge a')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
