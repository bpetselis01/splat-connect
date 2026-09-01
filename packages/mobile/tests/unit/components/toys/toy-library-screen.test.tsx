// packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as the
// rest of the suite.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

// useSaves is mocked directly (rather than driven through apiClient) so a
// save press can be asserted against exactly what SaveButton is contracted
// to call — toggle('toys', id) — without also exercising the network layer.
const mockToggle = jest.fn()
const NO_SAVES = { tutorials: [], toys: [], challenges: [] }
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: NO_SAVES, isSaved: () => false, toggle: mockToggle }),
}))

const toy = (over: object) => ({
  id: 'toy1',
  owner_id: 'u1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: null,
  condition: 8,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'published',
  offer_type: 'donation',
  created_at: '',
  updated_at: '',
  profiles: { name: 'Jamie' },
  organizations: null,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
})

describe('ToyLibraryScreen', () => {
  it('renders toy names from the public toys endpoint', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('Switch car')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys')
  })

  it('filters the list by search text', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'switch')
    expect(screen.queryByText('Bubble machine')).toBeNull()
    expect(screen.getByText('Switch car')).toBeTruthy()
  })

  it('shows the holder line for a person-held toy and an org-held toy', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine', condition: 8, profiles: { name: 'Jamie' }, organizations: null }),
      toy({
        id: 't2',
        name: 'Switch car',
        condition: 5,
        owner_id: null,
        owner_org_id: 'org1',
        quantity: 4,
        profiles: null,
        organizations: { name: 'TAD Australia' },
      }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('8/10 · Held by Jamie', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByText('5/10 · Held by TAD Australia', { includeHiddenElements: true })).toBeTruthy()
  })

  it('shows the quantity badge only on the org-owned row', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine' }),
      toy({
        id: 't2',
        name: 'Switch car',
        owner_id: null,
        owner_org_id: 'org1',
        quantity: 4,
        organizations: { name: 'TAD Australia' },
      }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    // Badge text renders uppercased.
    expect(screen.getAllByText('4 AVAILABLE', { includeHiddenElements: true }).length).toBe(1)
    expect(screen.queryByText(/AVAILABLE/, { includeHiddenElements: true })).toBeTruthy()
  })

  it('shows the switch-adapted badge only when the toy is adapted', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Bubble machine', switch_adapted: false }),
      toy({ id: 't2', name: 'Switch car', switch_adapted: true }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    expect(screen.getAllByText('SWITCH-ADAPTED', { includeHiddenElements: true }).length).toBe(1)
  })

  it('filters by condition bucket', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Good toy', condition: 8 }),
      toy({ id: 't2', name: 'Worn toy', condition: 2 }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Good toy')
    fireEvent.press(screen.getByRole('button', { name: 'Well-loved (1–3)' }))
    expect(screen.queryByText('Good toy')).toBeNull()
    expect(screen.getByText('Worn toy')).toBeTruthy()
  })

  it('filters by the switch-adapted toggle', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Plain toy', switch_adapted: false }),
      toy({ id: 't2', name: 'Adapted toy', switch_adapted: true }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Plain toy')
    fireEvent.press(screen.getByRole('button', { name: 'Switch-adapted' }))
    expect(screen.queryByText('Plain toy')).toBeNull()
    expect(screen.getByText('Adapted toy')).toBeTruthy()
  })

  it('flips a save by calling toggle with the toys slug and the toy id', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getAllByLabelText('Save')[0])
    expect(mockToggle).toHaveBeenCalledWith('toys', 't1')
  })

  it('navigates to the toy detail route on card press', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    const card = await screen.findByLabelText('Bubble machine')
    fireEvent.press(card)
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  })

  it('navigates to give-a-toy and organisations from their respective rows', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByLabelText('+ Give a toy'))
    expect(mockPush).toHaveBeenCalledWith('/toys/new')
    fireEvent.press(screen.getByLabelText('Organisations'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisations')
  })

  it('shows an error message when apiClient.get rejects, and retries', async () => {
    mockGet.mockRejectedValueOnce(new Error('API GET failed with status 500'))
    render(<ToyLibraryScreen />)
    expect(await screen.findByText("Couldn't load toys.")).toBeTruthy()
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it('shows the count line', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' }), toy({ id: 't2', name: 'Switch car' })])
    render(<ToyLibraryScreen />)
    await waitFor(() => expect(screen.getByText('2 toys')).toBeTruthy())
  })
})
