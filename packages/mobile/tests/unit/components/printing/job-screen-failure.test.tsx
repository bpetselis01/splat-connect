// A print job whose first read fails: says so, Try again re-reads, nothing hits console.error.
// journeys: R06
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: null }) }) } } }))
jest.mock('expo-image-picker', () => ({}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: jest.fn(),
  useCapabilities: () => ({ caps: { profile: { id: 'family' }, ledOrgs: [] } }),
}))

const job = {
  id: 'j1', type: 'print', status: 'requested', requester_id: 'family', owner_id: 'maker', owner_org_id: null,
  requester_name: 'Fran Family', owner_name: 'Tom B.', tutorial_title: 'Switch mount', printer_id: null, printer: null,
  print_files: [{ id: 's1', filename: 'mount.stl', quantity: 1 }], print_group_id: 'g', print_group_size: 1,
  printing_started_at: null, ready_at: null, ready_photo_url: null, owner_code: '111111', requester_code: '222222',
  owner_confirmed_at: null, requester_confirmed_at: null, created_at: new Date().toISOString(), messages: [],
}

afterEach(() => jest.restoreAllMocks())

it('says the job could not load offline, and Try again loads it', async () => {
  const err = jest.spyOn(console, 'error')
  mockGet.mockReset().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(job)
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText("Couldn't load this print job.")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByLabelText('Progress: Requested')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
