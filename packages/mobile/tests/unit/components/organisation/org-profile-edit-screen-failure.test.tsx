// A failed page load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgProfileEditScreen } from '../../../../components/organisation/org-profile-edit-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
const mockCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: jest.fn() }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps }))
jest.mock('../../../../components/organisation/org-leaders-section', () => ({ OrgLeadersSection: () => null }))

it('offline: says so, Try again re-fetches and shows the form', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let orgCalls = 0
  mockGet.mockImplementation((p: string) => {
    if (p.endsWith('/thanks')) return Promise.resolve([])
    return orgCalls++ === 0
      ? Promise.reject(new Error('Network request failed'))
      : Promise.resolve({ name: 'Northside', kind: 'Therapy service', state: 'VIC' })
  })
  render(<OrgProfileEditScreen />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByRole('button', { name: 'Save and publish' })).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
