// packages/mobile/tests/unit/components/printing/job-screen.test.tsx
//
// The job page shows only the card for where the job is, and which side is
// looking decides what that card asks of them.
import { CLEARANCE, paddingBottomOf } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
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

const mockInvalidate = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: (...a: unknown[]) => mockInvalidate(...a),
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
  mockInvalidate.mockClear()
})

it('tells the family how many printers they asked while it waits', async () => {
  serve(job({}))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Asked 2 printers.')).toBeTruthy()
  expect(screen.getByLabelText('Progress: Requested')).toBeTruthy()
})

it('R09 shows the family the pickup card with their code once it is ready, and collects', async () => {
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

it('tells the family when the printer has to answer by, and says Expired after it', async () => {
  serve(job({ created_at: new Date(Date.now() - 8 * 864e5).toISOString() }))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText(/^This request expired on .+; ask again\.$/)).toBeTruthy()
  expect(screen.getAllByText('Expired').length).toBeGreaterThan(0)
})
it('R10 asks the family whether it fitted once collected', async () => {
  serve(job({ status: 'completed' }))
  mockPost.mockResolvedValue(job({ status: 'completed', print_fit: 'fitted' }))
  render(<PrintJobScreen id="j1" />)
  expect(
    await screen.findByText('One tap. It goes back to the printer and to the guide author so the next print is better.')
  ).toBeTruthy()
  fireEvent.press(screen.getByText('Fitted'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/print-fit', { fit: 'fitted' }))
  await waitFor(() => expect(mockInvalidate).toHaveBeenCalledTimes(1))
})

it('R11 thanks the printer through the contributor route, naming the job and carrying the note', async () => {
  serve(job({ status: 'completed' }))
  mockPost.mockResolvedValue({ thanks_count: 1 })
  render(<PrintJobScreen id="j1" />)
  fireEvent.press(await screen.findByText('Say thanks to the printer'))
  fireEvent.changeText(screen.getByLabelText('Thank-you note'), 'It fits perfectly')
  fireEvent.press(screen.getByText('Send thanks'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/contributors/maker/thanks', { note: 'It fits perfectly', transaction_id: 'j1' })
  )
  expect(await screen.findByText('Thanks sent — they will see it in their notifications')).toBeTruthy()
})

it('R11 thanks an organisation printer through the organisation route', async () => {
  serve(job({ status: 'completed', owner_id: 'leader', owner_org_id: 'org1' }))
  mockPost.mockResolvedValue({ thanks_count: 1 })
  render(<PrintJobScreen id="j1" />)
  fireEvent.press(await screen.findByText('Say thanks to the printer'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/org1/thanks', {}))
})

it('R04 shows the family the job, the printer and what it costs', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1'
      ? Promise.resolve(job({ status: 'accepted', printer_id: 'p1', printer: { id: 'p1', name: 'Prusa MK4' } }))
      : path === '/api/printers/p1'
        ? Promise.resolve({ id: 'p1', filament_cents_per_g: 5, rate_note: 'PLA only', printer_stats: { jobs: 4, median_days: 6, fitted: 0, fit_answers: 0, colours: [] } })
        : path === '/api/exchange-costs/j1'
          ? Promise.resolve({ total_cents: 350 })
          : Promise.reject(new Error('n/a'))
  )
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Switch mount')).toBeTruthy()
  expect(screen.getByText('1 part · asked today')).toBeTruthy()
  expect(await screen.findByText('On Prusa MK4')).toBeTruthy()
  expect(await screen.findByText('4 jobs · ~6 days')).toBeTruthy()
  expect(await screen.findByText('About $0.05 / g of filament, settled between you')).toBeTruthy()
  expect(screen.getByText('“PLA only”')).toBeTruthy()
  expect(await screen.findByText('$3.50')).toBeTruthy()
})

it('puts the spent recycling credit on the family’s cost card', async () => {
  serve(job({ status: 'accepted', owner_org_id: 'north', owner_id: null, print_credit_grams: 120 }))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Your recycling credit (120 g)')).toBeTruthy()
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('lifts the message composer one gutter above the home indicator', async () => {
  serve(job({}))
  render(<PrintJobScreen id="j1" />)
  await screen.findByText('Asked 2 printers.')
  expect(paddingBottomOf(screen.getByTestId('job-footer'))).toBe(CLEARANCE)
})
