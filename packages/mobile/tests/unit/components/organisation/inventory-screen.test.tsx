// packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { InventoryScreen } from '../../../../components/organisation/inventory-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

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
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
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
  cover_photo_url: null,
  switch_photo_urls: [],
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

describe('InventoryScreen', () => {
  it('lists the stock with quantity and status', async () => {
    mockGet.mockResolvedValue([
      stock({ id: 'toy1', name: 'Bear', quantity: 5 }),
      stock({ id: 'toy2', name: 'Drum', quantity: 1, status: 'draft' }),
    ])
    render(<InventoryScreen />)

    expect(await screen.findByText('Bear')).toBeTruthy()
    expect(screen.getByText('Drum')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    // The badges hide behind the row's a11y hint, so the query opts in.
    expect(screen.getByText('DRAFT', { includeHiddenElements: true })).toBeTruthy()
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

  it('offers Add stock, which lands on the add-toy screen', async () => {
    render(<InventoryScreen />)
    fireEvent.press(await screen.findByRole('button', { name: '+ Add stock' }))
    expect(mockPush).toHaveBeenCalledWith('/toys/new')
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
})
