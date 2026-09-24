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
    if (path === '/api/organizations/org1') return Promise.resolve({ id: 'org1', name: 'N', recycling_materials: ['PLA'], recycling_note: null })
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

it('weighs and credits in grams, and holds the button while credit exceeds the weight', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  expect(await screen.findByText('Tom Beattie')).toBeTruthy()

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '2')
  fireEvent.changeText(screen.getByLabelText('Credit, in kilograms'), '2.5')
  const confirm = screen.getByLabelText("Weigh and credit Tom Beattie's drop-off")
  expect(confirm.props.accessibilityState.disabled).toBe(true)

  fireEvent.changeText(screen.getByLabelText('Credit, in kilograms'), '1.5')
  fireEvent.press(confirm)
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
      status: 'received',
      weighed_grams: 2000,
      credit_grams: 1500,
    })
  )
})

it('turns one away without sending any grams', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  fireEvent.press(await screen.findByLabelText("Turn away Tom Beattie's drop-off as contaminated"))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'declined' })
  )
})

it('settled drop-offs get a pill and no actions', async () => {
  route([drop({ id: 'd2', status: 'received', weighed_grams: 3200, credit_grams: 2400 }), drop({ id: 'd3', contributor_id: 'anon', contributor_name: null, status: 'declined' })])
  render(<IntakeScreen />)
  expect(await screen.findByText('Credited')).toBeTruthy()
  expect(screen.getByText('Turned away')).toBeTruthy()
  expect(screen.getByText('A contributor')).toBeTruthy()
  expect(screen.getByText('Nothing booked in right now.')).toBeTruthy()
  expect(screen.queryByText('Weigh and credit')).toBeNull()
})
