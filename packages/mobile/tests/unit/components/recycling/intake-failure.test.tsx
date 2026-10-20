// The leader's intake when the queue fails to load: says so, Try again re-reads, nothing hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { IntakeScreen } from '../../../../components/recycling/intake-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({
    caps: { profile: { id: 'lee', name: 'Lee' }, isAdmin: false, ledOrgs: [{ id: 'org1', name: 'N' }], unread: {}, exchangeActions: 0 },
    loading: false,
    refresh: jest.fn(),
  }),
}))

const ORG = { id: 'org1', name: 'N', recycling_materials: ['PLA'], recycling_note: null, recycling_machines: [], recycling_forms: [], recycling_min_kg: null, recycling_max_kg: null, recycling_turnaround: null, recycling_gives: 'credit', recycling_hours: null, recycling_door: null }
const DROP = {
  id: 'd1', org_id: 'org1', contributor_id: 'tom', contributor_name: 'Tom Beattie', material: 'PLA', estimated_grams: 2600,
  condition_declared: true, declaration_version: 'v1-2026-09', photo_url: null, note: null, status: 'booked',
  weighed_grams: null, credit_grams: null, decided_by: null, created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
}

afterEach(() => jest.restoreAllMocks())

it('L12 says the intake could not load, and Try again loads the queue', async () => {
  const err = jest.spyOn(console, 'error')
  let offline = true
  mockGet.mockReset().mockImplementation((p: string) =>
    offline ? Promise.reject(new Error('Network request failed')) : Promise.resolve(p === '/api/organizations/org1' ? ORG : [DROP])
  )
  render(<IntakeScreen />)
  expect(await screen.findByText("Couldn't load your intake — try again.")).toBeTruthy()
  offline = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Tom Beattie')).toBeTruthy()
  expect(err).not.toHaveBeenCalled()
})
