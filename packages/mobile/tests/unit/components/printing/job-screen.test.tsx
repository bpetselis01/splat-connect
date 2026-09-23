// packages/mobile/tests/unit/components/printing/job-screen.test.tsx
//
// The job page shows only the card for where the job is, and which side is
// looking decides what that card asks of them.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) } },
}))
jest.mock('expo-image-picker', () => ({}))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})

jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'family' }, ledOrgs: [] } }),
}))

const job = (over: object) => ({
  id: 'j1',
  type: 'print',
  status: 'requested',
  requester_id: 'family',
  owner_id: 'maker',
  owner_org_id: null,
  requester_name: 'Family',
  owner_name: 'Tom B.',
  tutorial_title: 'Switch mount',
  printer_id: null,
  printer: null,
  print_files: [{ id: 's1', filename: 'mount.stl', quantity: 1 }],
  print_group_id: 'g',
  print_group_size: 2,
  printing_started_at: null,
  ready_at: null,
  ready_photo_url: null,
  owner_code: '111111',
  requester_code: '222222',
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  created_at: new Date().toISOString(),
  messages: [],
  ...over,
})

function serve(detail: object) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1' ? Promise.resolve(detail) : Promise.reject(new Error('n/a'))
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
})

it('tells the family how many printers they asked while it waits', async () => {
  serve(job({}))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Asked 2 printers.')).toBeTruthy()
  expect(screen.getByLabelText('Progress: Requested')).toBeTruthy()
})

it('shows the family the pickup card with their code once it is ready, and collects', async () => {
  serve(job({ status: 'accepted', printing_started_at: 'x', ready_at: 'y', pickup_suburb: 'Newtown' }))
  mockPost.mockResolvedValue(job({ status: 'accepted', requester_confirmed_at: 'z' }))
  render(<PrintJobScreen id="j1" />)

  // The status pill and the card title both say it.
  expect(await screen.findAllByText('Ready for pickup')).toHaveLength(2)
  expect(screen.getByText('222222')).toBeTruthy()
  expect(screen.queryByText('Asked 2 printers.')).toBeNull()

  fireEvent.changeText(screen.getByLabelText('Their code'), '111111')
  fireEvent.press(screen.getByText('I have collected it'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/confirm', { code: '111111' })
  )
})

it('gives the reason a printer declined', async () => {
  serve(job({ status: 'rejected', decline_reason: 'No PETG on hand' }))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Tom B. could not take it')).toBeTruthy()
  expect(screen.getByText('No PETG on hand — another printer may be able to.')).toBeTruthy()
})
