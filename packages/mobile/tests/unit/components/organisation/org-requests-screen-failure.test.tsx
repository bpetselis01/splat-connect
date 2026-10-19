// A failed requests load says so (not "no requests"), retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgRequestsScreen } from '../../../../components/organisation/org-requests-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }) }))

it('offline: says so, Try again re-fetches and shows the queue', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<OrgRequestsScreen />)
  expect(await screen.findByText("Couldn't load the requests.")).toBeTruthy()
  mockGet.mockResolvedValueOnce([])
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('No toy requests right now.')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
