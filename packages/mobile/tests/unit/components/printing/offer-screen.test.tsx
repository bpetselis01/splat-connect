// packages/mobile/tests/unit/components/printing/offer-screen.test.tsx
//
// Print for others: an organisation's request gets the machine picker, which
// preselects the best fit and stamps the choice on accept; declining sends a
// reason.
// journeys: L11 R07 R12 R13
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PrintForOthersScreen } from '../../../../components/printing/offer-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-image-picker', () => ({}))

const mockSubmit = jest.fn()
jest.mock('../../../../components/printing/actions', () => ({
  ...jest.requireActual('../../../../components/printing/actions'),
  submitTestPrint: (...a: unknown[]) => mockSubmit(...a),
}))

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
  useCapabilities: () => ({ caps: { profile: { id: 'leader' }, ledOrgs: [{ id: 'org', name: 'Library' }] } }),
}))

const machine = (id: string, over: object = {}) => ({
  id,
  name: id,
  owner_id: null,
  owner_org_id: 'org',
  org_name: 'Library',
  materials: ['PETG'],
  bed_x: 220,
  accepting: true,
  capacity: 2,
  open_jobs: 0,
  notes: null,
  ...over,
})

const REQUEST = {
  id: 'j1',
  type: 'print',
  status: 'requested',
  printer_id: 'Ender PLA',
  owner_id: null,
  owner_org_id: 'org',
  print_group_id: 'g',
  tutorial_title: 'Switch mount',
  requester_suburb: 'Newtown',
  print_delivery: 'collect',
  print_colour: 'Any colour',
  print_note: null,
  print_files: [{ id: 's1', filename: 'm.stl', quantity: 1, material: 'PETG', print_minutes: 60, filament_grams: 10 }],
  blocked_by_rival_accept: false,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({})
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/printers/mine')
      return Promise.resolve([
        machine('Ender PLA', { materials: ['PLA'] }),
        machine('Bambu P1S', { bed_x: 256 }),
        machine('Prusa full', { open_jobs: 2 }),
      ])
    // The list carries the whole group's size (074) — no per-job detail read.
    if (path === '/api/toy-transactions') return Promise.resolve([{ ...REQUEST, print_group_size: 2 }])
    return Promise.reject(new Error('unexpected GET ' + path))
  })
})

it('preselects the machine that fits and accepts on it', async () => {
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('Accept on Bambu P1S')).toBeTruthy()
  expect(await screen.findByText('Also asked 1 other. Settings from the guide: PETG.')).toBeTruthy()

  fireEvent.press(screen.getByText('Accept on Bambu P1S'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/accept', { printer_id: 'Bambu P1S' })
  )
  expect(mockInvalidate).toHaveBeenCalled()
})

it('lets a leader override with a machine that needs a change', async () => {
  render(<PrintForOthersScreen />)
  await screen.findByText('Accept on Bambu P1S')
  fireEvent.press(screen.getByText('Ender PLA'))
  expect(screen.getByText('Accept anyway on Ender PLA')).toBeTruthy()
})

it('declines with a reason', async () => {
  render(<PrintForOthersScreen />)
  await screen.findByText('Accept on Bambu P1S')
  fireEvent.press(screen.getByText('Decline…'))
  fireEvent.press(screen.getByText('Too big for my bed'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/reject', { reason: 'Too big for my bed' })
  )
})

it("scoped to an organisation, shows only that organisation's machines and jobs", async () => {
  render(<PrintForOthersScreen orgId="elsewhere" />)
  // Every fixture machine belongs to 'org', so the job on 'Ender PLA' is not
  // this organisation's to answer.
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/printers/mine'))
  expect(screen.queryByText('Also asked 1 other. Settings from the guide: PETG.')).toBeNull()
})

it('leaves an expired request off the Requests tab', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? // The job's own machine, or it is filtered out as not mine and the test proves nothing.
          [machine('Ender PLA', { materials: ['PLA'] })]
        : [{ ...REQUEST, created_at: new Date(Date.now() - 8 * 864e5).toISOString() }]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('Nothing waiting')).toBeTruthy()
})

it('shows each machine’s record in the picker', async () => {
  const stats = { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: ['Black', 'White'] }
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Ender PLA', { materials: ['PLA'] }), machine('Bambu P1S', { bed_x: 256, printer_stats: stats })]
        : [REQUEST]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('21 completed · median 3 days')).toBeTruthy()
  expect(screen.getByText('20 of 21 fitted first time')).toBeTruthy()
  expect(screen.getByText('Colours: Black, White')).toBeTruthy()
})

it('shows the printer the family’s customization answers', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Ender PLA', { materials: ['PLA'] })]
        : [{ ...REQUEST, print_fit_notes: { reach: '20–40 cm' } }]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('Reach from seated: 20–40 cm')).toBeTruthy()
})

it('offers Get verified on a printer, and shows a failed test print’s note', async () => {
  mockSubmit.mockResolvedValue({})
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Bambu P1S', { test_print: { verdict: 'fail', note: 'Stringing on the arch.', submitted_at: '' } }), machine('Prusa', { test_print: { verdict: null, note: null, submitted_at: '' } })]
        : []
    )
  )
  render(<PrintForOthersScreen />)
  fireEvent.press(await screen.findByText('My printers'))
  expect(screen.getByText('Failed')).toBeTruthy()
  expect(screen.getByText('“Stringing on the arch.”')).toBeTruthy()
  expect(screen.getByText('Waiting')).toBeTruthy()
  fireEvent.press(screen.getByText('Get verified'))
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('Bambu P1S'))
})
