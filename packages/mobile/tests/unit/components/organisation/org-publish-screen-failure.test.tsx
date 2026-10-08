// A failed events+stories load says so, retries on Try again, and never hits console.error.
// journeys: L18
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgPublishScreen } from '../../../../components/organisation/org-publish-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
const mockCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps }))
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: jest.fn() }))

it('offline: says so, Try again re-fetches and shows the lists', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) =>
    down ? Promise.reject(new Error('Network request failed')) : Promise.resolve(p.endsWith('/events') ? [] : [])
  )
  render(<OrgPublishScreen />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('No events yet')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
