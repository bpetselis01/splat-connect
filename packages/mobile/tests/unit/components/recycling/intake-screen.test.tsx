import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { IntakeScreen } from '../../../../components/recycling/intake-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
// ErrorRow lives in auth-screen, which pulls the auth context in.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const caps = (ledOrgs: { id: string; name: string }[]) => ({
  caps: { profile: { id: 'lee', name: 'Lee' }, isAdmin: false, ledOrgs, unread: {}, exchangeActions: 0 },
  loading: false,
  refresh: jest.fn(),
})

const drop = (over: object) => ({
  id: 'd1',
  org_id: 'org1',
  contributor_id: 'tom',
  contributor_name: 'Tom Beattie',
  material: 'PLA',
  estimated_grams: 2600,
  condition_declared: true,
  declaration_version: 'v1-2026-09',
  photo_url: null,
  note: null,
  status: 'booked',
  weighed_grams: null,
  credit_grams: null,
  decided_by: null,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
  ...over,
})

function route(drops: object[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/organizations/org1') return Promise.resolve({ id: 'org1', name: 'N', recycling_materials: ['PLA'], recycling_note: null, recycling_machines: [], recycling_forms: [], recycling_min_kg: null, recycling_max_kg: null, recycling_turnaround: null, recycling_gives: 'credit', recycling_hours: null, recycling_door: null })
    if (path === '/api/organizations/org1/recycling') return Promise.resolve(drops)
    return Promise.reject(new Error('API GET failed with status 404: Not found'))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'N' }]))
  mockPatch.mockResolvedValue({})
})

it('tells a non-leader the screen is not theirs', () => {
  mockUseCapabilities.mockReturnValue(caps([]))
  render(<IntakeScreen />)
  expect(screen.getByText('This screen belongs to organisation leaders.')).toBeTruthy()
  expect(mockGet).not.toHaveBeenCalled()
})

it('prefills the credit from the weight, sends what the box holds, and says so', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  expect(await screen.findByText('Tom Beattie')).toBeTruthy()
  expect(screen.getByText('Weigh it to see the credit')).toBeTruthy()

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '2.6')
  expect(screen.getByLabelText('Credit, in grams').props.value).toBe('1950')
  expect(screen.getByText('1950 g credit')).toBeTruthy()

  fireEvent.press(screen.getByLabelText("Weigh and credit Tom Beattie's drop-off"))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
      status: 'received',
      weighed_grams: 2600,
      credit_grams: 1950,
    })
  )
  expect(await screen.findByText('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')).toBeTruthy()
})

it('keeps an edited credit when the weight changes, and holds the button above the weight', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  await screen.findByText('Tom Beattie')
  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '3')
  fireEvent.changeText(screen.getByLabelText('Credit, in grams'), '2000')
  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '4')
  expect(screen.getByLabelText('Credit, in grams').props.value).toBe('2000')

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '1.8')
  expect(screen.getByText('Under the 2 kg minimum — log it as a donation or hand it back')).toBeTruthy()
  const confirm = screen.getByLabelText("Weigh and credit Tom Beattie's drop-off")
  expect(confirm.props.accessibilityState.disabled).toBe(true)

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '2')
  fireEvent.changeText(screen.getByLabelText('Credit, in grams'), '2500')
  expect(screen.getByText('Credit cannot be more than what was weighed.')).toBeTruthy()
  expect(confirm.props.accessibilityState.disabled).toBe(true)
})

it('turns one away without sending any grams', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  fireEvent.press(await screen.findByLabelText("Turn away Tom Beattie's drop-off as contaminated"))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'declined' })
  )
})

it('L12 settled drop-offs get a pill and no actions', async () => {
  route([drop({ id: 'd2', status: 'received', weighed_grams: 3200, credit_grams: 2400 }), drop({ id: 'd3', contributor_id: 'anon', contributor_name: null, status: 'declined' })])
  render(<IntakeScreen />)
  expect(await screen.findByText('Credited')).toBeTruthy()
  expect(screen.getByText('Turned away')).toBeTruthy()
  expect(screen.getByText('A contributor')).toBeTruthy()
  expect(screen.getByText('Nothing booked in right now.')).toBeTruthy()
  expect(screen.queryByText('Weigh and credit')).toBeNull()
})

it('shows the leader the photo the contributor booked with', async () => {
  route([drop({ photo_url: 'tom/x.jpg', photo_signed_url: 'https://signed/x.jpg' })])
  render(<IntakeScreen />)
  const photo = await screen.findByLabelText('Photo of the sorted plastic')
  expect(photo.props.source).toEqual({ uri: 'https://signed/x.jpg' })
})

it('L15 publishes what the machines take, in one PATCH', async () => {
  route([])
  render(<IntakeScreen />)
  fireEvent.press(await screen.findByLabelText('Shredder'))
  fireEvent.press(screen.getByLabelText('Offcuts'))
  fireEvent.changeText(screen.getByLabelText('Maximum'), '8')
  fireEvent.press(screen.getByLabelText('A spool back'))
  fireEvent.changeText(screen.getByLabelText('Which door'), 'Back gate')
  fireEvent.press(screen.getByLabelText('Save what you take'))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/profile', {
      recycling_materials: ['PLA'],
      recycling_note: '',
      recycling_machines: ['Shredder'],
      recycling_forms: ['Offcuts'],
      recycling_min_kg: null,
      recycling_max_kg: 8,
      recycling_turnaround: '',
      recycling_gives: 'spool',
      recycling_hours: '',
      recycling_door: 'Back gate',
    })
  )
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends its scroll one gutter above the home indicator', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  await screen.findByText('Tom Beattie')
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})
