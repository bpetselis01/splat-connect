// A failed shelf load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { InventoryScreen } from '../../../../components/organisation/inventory-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { isAdmin: false, ledOrgs: [{ id: 'org1', name: 'Riverside Therapy' }] }, loading: false, refresh: jest.fn() }),
}))

it('offline: says so, Try again re-fetches and shows the stock', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  const stock = {
    id: 'toy1', owner_id: null, owner_org_id: 'org1', quantity: 5, name: 'Bear', description: null, condition: 8,
    switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
    offer_type: 'donation', created_at: '', updated_at: '', organizations: { name: 'Riverside Therapy' },
  }
  // Focus re-fetches on mount, so answer by state rather than by call count.
  mockGet.mockImplementation(() => (down ? Promise.reject(new Error('Network request failed')) : Promise.resolve([stock])))
  render(<InventoryScreen />)
  expect(await screen.findByText("Couldn't load the shelf.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bear')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
