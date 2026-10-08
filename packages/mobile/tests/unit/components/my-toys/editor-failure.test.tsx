// A failed toy load says so, retries on Try again, and never hits console.error.
// journeys: W06
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-toys/editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() }), useFocusEffect: (e: () => (() => void) | void) => useEffect(e, []) }
})
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: jest.fn(), post: jest.fn(), delete: jest.fn() } }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
jest.mock('expo-image-picker', () => ({}))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'viewer1', name: 'Viewer' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 }, loading: false, refresh: jest.fn() }),
}))

const toy = {
  id: 'toy1', owner_id: 'viewer1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 5,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'draft', offer_type: null,
  created_at: '', updated_at: '',
}

it('offline: says so, Try again re-fetches and shows the toy', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) => {
    if (p === '/api/toys') return down ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve([toy])
    return Promise.resolve([])
  })
  render(<Editor id="toy1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect((await screen.findAllByDisplayValue('Bubble machine')).length).toBeGreaterThan(0)
  expect(errSpy).not.toHaveBeenCalled()
})
