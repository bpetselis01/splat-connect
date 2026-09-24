// packages/mobile/tests/unit/components/printing/find-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { FindPrinterScreen } from '../../../../components/printing/find-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] } }),
}))

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
