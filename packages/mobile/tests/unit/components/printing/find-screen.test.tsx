// packages/mobile/tests/unit/components/printing/find-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { FindPrinterScreen } from '../../../../components/printing/find-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockCaps: { profile: Record<string, unknown>; ledOrgs: unknown[] } = { profile: { id: 'me' }, ledOrgs: [] }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))

const printer = (id: string, over: object = {}) => ({
  id,
  owner_id: `owner-${id}`,
  owner_org_id: null,
  owner_name: `Maker ${id.toUpperCase()}`,
  org_name: null,
  name: 'Prusa',
  materials: ['PETG'],
  bed_x: 220,
  accepting: true,
  capacity: 2,
  open_jobs: 0,
  suburb: null,
  state: null,
  ...over,
})

const GUIDE = {
  id: 'g1',
  title: 'Switch mount',
  stl_files: [{ id: 's1', filename: 'mount.stl', print_minutes: 60, filament_grams: 10, material: 'PETG' }],
}

beforeEach(() => {
  mockPush.mockClear()
  delete mockCaps.profile.pickup_postcode
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a'), printer('b'), printer('c'), printer('d'), printer('mine', { owner_id: 'me', owner_name: 'Me' })]
        : GUIDE
    )
  )
})

it('picks up to three printers, then sends them to the request form', async () => {
  render(<FindPrinterScreen guideId="g1" />)
  await screen.findByText('Switch mount')

  // Your own machine is never offered.
  expect(screen.queryByText('Me')).toBeNull()
  expect(screen.getByText('Pick a printer to continue')).toBeTruthy()

  for (const id of ['A', 'B', 'C']) fireEvent.press(screen.getByLabelText(`Pick Maker ${id}`))
  expect(screen.getByText('Ask 3 printers')).toBeTruthy()
  // The fourth is disabled until one is unpicked.
  expect(screen.getByLabelText('Pick Maker D')).toBeDisabled()

  fireEvent.press(screen.getByText('Ask 3 printers'))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing/request', params: { guide: 'g1', printers: 'a,b,c' } })
})

it('browses without Pick buttons when no guide is given', async () => {
  render(<FindPrinterScreen />)
  await screen.findByText('Every request starts from a guide')
  expect(screen.queryByLabelText('Pick Maker A')).toBeNull()
})

it('shows a printer’s jobs and turnaround under its name', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a', { printer_stats: { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: [] } })]
        : GUIDE
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText(/21 jobs · ~3 days/)).toBeTruthy()
})

it('hides a printer whose bed cannot hold the guide’s parts', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a', { bed_x: 180, bed_y: 180, bed_z: 180 }), printer('b', { bed_x: 256, bed_y: 256, bed_z: 256 })]
        : { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], size_x_mm: 200, size_y_mm: 100, size_z_mm: 50 }] }
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText('Maker B')).toBeTruthy()
  expect(screen.queryByText('Maker A')).toBeNull()
})

it('says no printer matches, not nobody listed, when the only printer is too small', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a', { bed_x: 100, bed_y: 100, bed_z: 100 })]
        : { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], size_x_mm: 200, size_y_mm: 100, size_z_mm: 50 }] }
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText('No printer matches')).toBeTruthy()
  expect(screen.queryByText('Nobody has listed a printer yet')).toBeNull()
})

it('filters to verified printers and marks them', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/printers' ? [printer('a', { verified: true }), printer('b')] : GUIDE)
  )
  render(<FindPrinterScreen guideId="g1" />)
  await screen.findByText('Maker B')
  // The seal, not the chip: Ionicons is mocked to a host element, so its props are queryable.
  expect(screen.UNSAFE_getAllByProps({ name: 'shield-checkmark', accessibilityLabel: 'Verified' })).toHaveLength(1)
  fireEvent.press(screen.getByText('Verified'))
  expect(screen.queryByText('Maker B')).toBeNull()
  expect(screen.getByText('Maker A')).toBeTruthy()
})

it('asks for a postcode before it can say what is within 10 km', async () => {
  render(<FindPrinterScreen guideId="g1" />)
  fireEvent.press(await screen.findByText('Add your postcode'))
  expect(mockPush).toHaveBeenCalledWith('/account')
})

it('measures from the profile postcode and keeps what is within 10 km', async () => {
  mockCaps.profile.pickup_postcode = '2000'
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers?near=2000' ? [printer('a', { km: 4 }), printer('b', { km: 40 })] : GUIDE
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText(/· 4 km/)).toBeTruthy()
  fireEvent.press(screen.getByText('Within 10 km'))
  expect(screen.queryByText('Maker B')).toBeNull()
  expect(screen.getByText('Maker A')).toBeTruthy()
})
