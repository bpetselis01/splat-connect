// packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { InventoryScreen } from '../../../../components/organisation/inventory-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const leader = (orgs: { id: string; name: string }[]) => ({
  caps: {
    profile: { id: 'leader1', name: 'Lee', role: 'contributor' },
    isAdmin: false,
    ledOrgs: orgs,
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})

const stock = (over: object) => ({
  id: 'toy1',
  owner_id: null,
  owner_org_id: 'org1',
  quantity: 5,
  name: 'Bear',
  description: null,
  condition: 8,
  switch_adapted: false,
  photo_urls: [],
  cover_photo_url: null,
  switch_photo_url: null,
  status: 'published',
  offer_type: 'donation',
  created_at: '',
  updated_at: '',
  organizations: { name: 'Riverside Therapy' },
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(leader([{ id: 'org1', name: 'Riverside Therapy' }]))
  mockGet.mockResolvedValue([])
})

afterEach(() => jest.restoreAllMocks())

describe('InventoryScreen', () => {
  it('lists the stock with quantity and status', async () => {
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Bear', quantity: 5 }),
      stock({ id: 'toy2', name: 'Drum', quantity: 1, status: 'draft' }),
    ])
    render(<InventoryScreen />)

    expect(await screen.findByText('Bear')).toBeTruthy()
    expect(screen.getByText('Drum')).toBeTruthy()
    expect(screen.getByText('5 in stock · Good')).toBeTruthy()
    // The board's shelf words: published is Available, anything else a Draft.
    expect(screen.getByText('Available')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    // The lead counts listings and units.
    expect(screen.getByText('2 listings, 6 units on the shelf.')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toys/inventory')
  })

  it('groups the shelves when the caller leads more than one organisation', async () => {
    mockUseCapabilities.mockReturnValue(
      leader([
        { id: 'org1', name: 'Riverside Therapy' },
        { id: 'org2', name: 'Northside Makers' },
      ])
    )
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Bear', owner_org_id: 'org1', organizations: { name: 'Riverside Therapy' } }),
      stock({ id: 'toy2', name: 'Drum', owner_org_id: 'org2', organizations: { name: 'Northside Makers' } }),
    ])
    render(<InventoryScreen />)

    expect(await screen.findByText('Riverside Therapy')).toBeTruthy()
    expect(screen.getByText('Northside Makers')).toBeTruthy()
  })

  it('opens a row in the toy editor', async () => {
    mockGet.mockResolvedValue([stock({ id: 'toy9', name: 'Open me' })])
    render(<InventoryScreen />)

    fireEvent.press(await screen.findByRole('button', { name: 'Open me' }))
    expect(mockPush).toHaveBeenCalledWith('/toys/toy9')
  })

  it('offers Add to inventory, which lands on the add-toy screen in org mode', async () => {
    render(<InventoryScreen />)
    fireEvent.press(await screen.findByRole('button', { name: '+ Add to inventory' }))
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/toys\/new\?org=.+/))
  })

  it('explains an empty shelf rather than apologising for it', async () => {
    render(<InventoryScreen />)
    expect(await screen.findByText('Nothing on the shelf yet.')).toBeTruthy()
  })

  it('explains itself to someone who leads no organisation', async () => {
    mockUseCapabilities.mockReturnValue(leader([]))
    render(<InventoryScreen />)

    expect(await screen.findByText('This screen belongs to organisation leaders.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('shows a retired toy with its reason, and removes it from the shelf', async () => {
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Spinning top', quantity: 1, retired_at: '2026-08-12T00:00:00Z', retired_note: 'Broken 12 Aug', has_history: false }),
    ])
    mockDelete.mockResolvedValue({ id: 'toy1' })
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Remove')?.onPress?.()
    })
    render(<InventoryScreen />)
    expect(await screen.findByText('Retired')).toBeTruthy()
    expect(screen.getByText('Broken 12 Aug')).toBeTruthy()
    fireEvent.press(screen.getByText('Remove'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/toys/toy1'))
    expect(await screen.findByText('Spinning top removed from the shelf')).toBeTruthy()
    expect(screen.queryByText('Broken 12 Aug')).toBeNull()
  })

  it('keeps a retired toy with handovers on record: the pill and reason, no Remove', async () => {
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Spinning top', quantity: 1, retired_at: '2026-08-12T00:00:00Z', retired_note: 'Broken 12 Aug', has_history: true }),
    ])
    render(<InventoryScreen />)
    expect(await screen.findByText('Retired')).toBeTruthy()
    expect(screen.getByText('Broken 12 Aug')).toBeTruthy()
    expect(screen.queryByText('Remove')).toBeNull()
  })

  it('offers no Remove on a toy still on offer', async () => {
    mockGet.mockResolvedValue([stock({ id: 'toy1', name: 'Bear', has_history: false })])
    render(<InventoryScreen />)
    await screen.findByText('Bear')
    expect(screen.queryByText('Remove')).toBeNull()
  })

  it("says why when the API refuses to remove a toy with history", async () => {
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Spinning top', quantity: 1, retired_at: '2026-08-12T00:00:00Z', retired_note: null, has_history: false }),
    ])
    mockDelete.mockRejectedValue(
      new Error('API DELETE /api/toys/toy1 failed with status 409: This toy has handovers on record, so it stays on the shelf as retired.')
    )
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Remove')?.onPress?.()
    })
    render(<InventoryScreen />)
    fireEvent.press(await screen.findByText('Remove'))
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Could not remove Spinning top',
        'This toy has handovers on record, so it stays on the shelf as retired.'
      )
    )
    expect(screen.getByText('Spinning top')).toBeTruthy()
  })
})
