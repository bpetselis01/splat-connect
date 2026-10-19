// A failed inbox load says so (not "nobody has written"), retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgMessagesScreen } from '../../../../components/organisation/org-messages-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
const mockCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps }))

it('offline: says so, Try again re-fetches and shows the inbox', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<OrgMessagesScreen />)
  expect(await screen.findByText("Couldn't load your messages.")).toBeTruthy()
  mockGet.mockResolvedValueOnce([])
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Nobody has written yet.')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
