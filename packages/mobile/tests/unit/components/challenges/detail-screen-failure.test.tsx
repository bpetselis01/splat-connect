// A failed brief load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChallengeDetailScreen } from '../../../../components/challenges/detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../../lib/recents', () => ({ recordRecent: jest.fn() }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, loading: false, refresh: jest.fn() }) }))

it('C02 offline: says so, Try again re-fetches and shows the brief', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({
    id: 'c1',
    author_id: 'a1',
    author_name: 'Priya',
    title: 'A switch a toddler can hit',
    summary: 'Needs less force.',
    description: 'She swipes.',
    intended_use: 'Bubbles.',
    primary_user: 'A child.',
    contact_prefs: [],
    status: 'challenge',
    tutorial_id: null,
    participants: [],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  })
  render(<ChallengeDetailScreen id="c1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect((await screen.findAllByText('A switch a toddler can hit')).length).toBeGreaterThan(0)
  expect(errSpy).not.toHaveBeenCalled()
})
