// packages/mobile/tests/unit/components/printing/offer-screen.test.tsx
//
// Print for others: an organisation's request gets the machine picker, which
// preselects the best fit and stamps the choice on accept; declining sends a
// reason.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PrintForOthersScreen } from '../../../../components/printing/offer-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
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
    if (path === '/api/toy-transactions') return Promise.resolve([REQUEST])
    return Promise.resolve({ ...REQUEST, print_group_size: 2 })
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
