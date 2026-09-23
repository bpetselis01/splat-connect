import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DECLARATION_VERSION, RECYCLING_DECLARATION } from '@splat-connect/types'
import { RecyclingScreen } from '../../../../components/recycling/recycling-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))

const ORGS = [
  { id: 'north', name: 'Northside Therapy', status: 'active', suburb: 'Crows Nest', state: 'NSW', recycling_materials: ['PLA', 'PETG'], recycling_note: 'Tue and Thu, 9am–4pm' },
  { id: 'none', name: 'Takes Nothing', status: 'active', suburb: null, state: null, recycling_materials: [], recycling_note: null },
  { id: 'susp', name: 'Suspended Space', status: 'suspended', suburb: null, state: null, recycling_materials: ['PLA'], recycling_note: null },
]
// GET /recycling/mine is already only the caller's rows (RLS + the filter).
const MINE = [
  { id: 'mine', org_id: 'north', contributor_id: 'me', material: 'PETG', estimated_grams: 3000, status: 'received', weighed_grams: 3200, credit_grams: 2400, created_at: '2026-08-12T00:00:00Z' },
  { id: 'waiting', org_id: 'north', contributor_id: 'me', material: 'PLA', estimated_grams: 2000, status: 'booked', weighed_grams: null, credit_grams: null, created_at: '2026-09-01T00:00:00Z' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/public/organizations' ? ORGS : path === '/api/organizations/recycling/mine' ? MINE : [])
  )
  mockPost.mockResolvedValue({})
})

it('lists only active organisations that take plastic, and your drop-offs', async () => {
  render(<RecyclingScreen />)
  expect(await screen.findByText('Northside Therapy')).toBeTruthy()
  expect(screen.queryByText('Takes Nothing')).toBeNull()
  expect(screen.queryByText('Suspended Space')).toBeNull()
  expect(screen.getByText('3.2 kg PETG')).toBeTruthy()
  expect(screen.getByText('+2400 g')).toBeTruthy()
  expect(screen.getByText('2,400 g of print credit issued')).toBeTruthy()
})

it('books only after two kilos and all seven lines, sending the declaration version', async () => {
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  expect(screen.getByText('Drop-off at Northside Therapy')).toBeTruthy()

  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '2.5')
  fireEvent.press(screen.getByLabelText('PETG'))
  const book = screen.getByLabelText('Book the drop-off')
  expect(book.props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText('7 declaration lines still to tick.')).toBeTruthy()

  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  expect(book.props.accessibilityState.disabled).toBe(false)
  fireEvent.press(book)

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/north/recycling', {
      material: 'PETG',
      estimated_grams: 2500,
      condition_declared: true,
      declaration_version: DECLARATION_VERSION,
      note: '',
    })
  )
  expect(await screen.findByText('Booked — Northside Therapy expects about 2.5 kg.')).toBeTruthy()
})

it('cancels a booking that is still waiting, and only that one', async () => {
  mockPost.mockResolvedValue({ status: 'cancelled' })
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Cancel the PLA drop-off'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/north/recycling/waiting/cancel', {})
  )
  expect(screen.queryByLabelText('Cancel the PETG drop-off')).toBeNull()
})
