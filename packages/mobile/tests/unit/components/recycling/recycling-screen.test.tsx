// journeys: V04 V05 V06
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
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    // Nothing here navigates; the mock keeps any stray useRouter call harmless.
    useRouter: () => ({ push: jest.fn() }),
  }
})
let mockCaps: { profile: { id: string }; ledOrgs: never[] } | null = { profile: { id: 'me' }, ledOrgs: [] }
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockCaps, loading: false, refresh: jest.fn() }),
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => Promise.resolve({ granted: true }),
  launchImageLibraryAsync: () =>
    Promise.resolve({ canceled: false, assets: [{ uri: 'file:///bag.jpg', fileName: 'bag.jpg', mimeType: 'image/jpeg' }] }),
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))

const ORGS = [
  { id: 'north', name: 'Northside Therapy', status: 'active', suburb: 'Crows Nest', state: 'NSW', recycling_materials: ['PLA', 'PETG'], recycling_note: 'Bring it sorted.', recycling_machines: ['Shredder', 'Extruder'], recycling_forms: ['Failed prints', 'Offcuts'], recycling_min_kg: 2, recycling_max_kg: 8, recycling_turnaround: 'About 3 weeks', recycling_gives: 'credit', recycling_hours: 'Tue and Thu, 9am–4pm', recycling_door: 'Loading door on Corella Lane' },
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
  mockCaps = { profile: { id: 'me' }, ledOrgs: [] }
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/public/organizations' ? ORGS : path === '/api/organizations/recycling/mine' ? MINE : path === '/api/organizations/recycling/credit' ? [{ org_id: 'north', org_name: 'Northside Therapy', grams: 1900, weighed_grams: 3200 }] : [])
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
  expect(screen.getByText('1,900 g of print credit unspent')).toBeTruthy()
})

it('still lists organisations and drop-offs when the credit read fails', async () => {
  const ok = mockGet.getMockImplementation()!
  mockGet.mockImplementation((path: string) =>
    path === '/api/organizations/recycling/credit' ? Promise.reject(new Error('down')) : ok(path)
  )
  render(<RecyclingScreen />)
  expect(await screen.findByText('Northside Therapy')).toBeTruthy()
  expect(screen.getByText('3.2 kg PETG')).toBeTruthy()
  expect(screen.getByText('0 g of print credit unspent')).toBeTruthy()
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

// Signed out there is nothing to load; the skeleton must not spin forever.
it('stops loading when signed out', async () => {
  mockCaps = null
  render(<RecyclingScreen />)
  await waitFor(() => expect(screen.queryByTestId('recycling-skeleton')).toBeNull())
})

it('uploads the photo of the sorted plastic and books with its path', async () => {
  mockUpload.mockResolvedValue({ path: 'me/0b5e7c8a-1d2e-4f3a-9b8c-7d6e5f4a3b2c.jpg', url: 'https://signed' })
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  expect(screen.getByText('Sorted, in the bag or box you will carry it in. It saves an argument at the door.')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  await waitFor(() =>
    expect(mockUpload).toHaveBeenCalledWith(
      '/api/upload/recycling-photo',
      '',
      { uri: 'file:///bag.jpg', name: 'bag.jpg', mimeType: 'image/jpeg' },
      null
    )
  )
  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '2.5')
  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  fireEvent.press(screen.getByLabelText('Book the drop-off'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/organizations/north/recycling',
      expect.objectContaining({ photo_url: 'me/0b5e7c8a-1d2e-4f3a-9b8c-7d6e5f4a3b2c.jpg' })
    )
  )
})

it('holds the Book button while the photo uploads, so the booking never goes without it', async () => {
  let finish: (v: { path: string; url: string }) => void = () => {}
  mockUpload.mockReturnValue(new Promise((r) => (finish = r)))
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '2.5')
  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  await waitFor(() => expect(mockUpload).toHaveBeenCalled())
  expect(screen.getByLabelText('Book the drop-off').props.accessibilityState.disabled).toBe(true)
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  expect(mockUpload).toHaveBeenCalledTimes(1)
  finish({ path: 'me/a.jpg', url: 'https://signed' })
  await waitFor(() =>
    expect(screen.getByLabelText('Book the drop-off').props.accessibilityState.disabled).toBe(false)
  )
})

it('says so when the photo upload fails, and clears it on a successful retry', async () => {
  mockUpload.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ path: 'me/a.jpg', url: 'https://signed' })
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  await waitFor(() => expect(screen.queryByText('Could not upload the photo. Please try again.')).toBeNull())
  expect(mockUpload).toHaveBeenCalledTimes(2)
})

it('draws the board’s card for each recycler, with the note below', async () => {
  render(<RecyclingScreen />)
  expect(await screen.findByText('PLA, PETG · Failed prints, Offcuts')).toBeTruthy()
  expect(screen.getByText('Shredder · Extruder')).toBeTruthy()
  expect(screen.getByText('2–8 kg · About 3 weeks')).toBeTruthy()
  expect(screen.getByText('Print credit')).toBeTruthy()
  expect(screen.getByText('Tue and Thu, 9am–4pm · Loading door on Corella Lane')).toBeTruthy()
  expect(screen.getByText('Bring it sorted.')).toBeTruthy()
})

it('holds a booking over the maximum', async () => {
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  expect(screen.getByText('Tue and Thu, 9am–4pm · Loading door on Corella Lane · 2–8 kg')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '9')
  expect(screen.getAllByText('Northside Therapy takes at most 8 kg at once.').length).toBeGreaterThan(0)
  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  expect(screen.getByLabelText('Book the drop-off').props.accessibilityState.disabled).toBe(true)
})
