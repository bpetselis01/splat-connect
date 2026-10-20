import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrganisationsScreen } from '../../../../components/admin/organisations-screen'
import { OrganisationManageScreen } from '../../../../components/admin/organisation-manage-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush, back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const acct = (id: string, name: string, role = 'contributor') => ({ id, name, email: `${name.toLowerCase()}@example.com`, role, created_at: '2026-03-01T00:00:00Z' })
const org = (over: Record<string, unknown> = {}) => ({
  id: 'o1', name: 'Riverside', description: 'Makers', status: 'active', verified_at: null, org_leaders: [{ user_id: 'a1' }], ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
  mockPatch.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
  mockGet.mockImplementation((path: string) =>
    path === '/api/organizations'
      ? Promise.resolve([org(), org({ id: 'o2', name: 'Empty Co', org_leaders: [] })])
      : Promise.resolve({ accounts: [acct('a1', 'Ada'), acct('a2', 'Bo'), acct('a3', 'Cy', 'parent')], total: 3 })
  )
})

describe('OrganisationsScreen', () => {
  it('Q32 Q33 lists organisations with their leaders and state, and opens one', async () => {
    render(<OrganisationsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: /Riverside/ }))
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.getByText('No leader')).toBeTruthy()
    expect(mockPush).toHaveBeenCalledWith('/admin/organisations/o1')
  })

  it('Q33 opens the create screen from the header button', async () => {
    render(<OrganisationsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'New organisation' }))
    expect(mockPush).toHaveBeenCalledWith('/admin/organisations/new')
  })

  it('shows an EmptyState with no organisations', async () => {
    mockGet.mockImplementation((path: string) => Promise.resolve(path === '/api/organizations' ? [] : { accounts: [], total: 0 }))
    render(<OrganisationsScreen />)
    expect(await screen.findByText('No organisations yet.')).toBeTruthy()
  })
})

describe('OrganisationManageScreen', () => {
  it('Q36 a leader added shows in the list', async () => {
    render(<OrganisationManageScreen orgId="o1" />)
    fireEvent.changeText(await screen.findByLabelText('Search accounts'), 'bo')
    fireEvent.press(screen.getByRole('button', { name: 'Pick Bo' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/admin/organizations/o1/leaders', { user_id: 'a2' }))
    expect(await screen.findByRole('button', { name: 'Remove Bo' })).toBeTruthy()
    expect(screen.getByText('Leaders (2)')).toBeTruthy()
  })

  it('only offers contributors as leaders', async () => {
    render(<OrganisationManageScreen orgId="o1" />)
    fireEvent.changeText(await screen.findByLabelText('Search accounts'), 'cy')
    expect(screen.queryByRole('button', { name: 'Pick Cy' })).toBeNull()
  })

  it('Q37 removing a leader drops it from the list', async () => {
    render(<OrganisationManageScreen orgId="o1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Remove Ada' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/admin/organizations/o1/leaders/a1'))
    await waitFor(() => expect(screen.getByText('Leaders (0)')).toBeTruthy())
  })

  it('Q38 Q39 suspends and verifies through the admin PATCH', async () => {
    render(<OrganisationManageScreen orgId="o1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Suspend' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/organizations/o1', { status: 'suspended' }))
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Mark verified' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/admin/organizations/o1', { verified: true }))
  })

  it('Q35 saves a rename', async () => {
    render(<OrganisationManageScreen orgId="o1" />)
    fireEvent.changeText(await screen.findByLabelText('Name'), ' Riverside Makers ')
    fireEvent.press(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/admin/organizations/o1', { name: 'Riverside Makers', description: 'Makers' })
    )
  })

  it('Q34 creates an organisation with its first leader and goes back', async () => {
    render(<OrganisationManageScreen />)
    fireEvent.changeText(await screen.findByLabelText('Name'), 'New Co')
    fireEvent.changeText(screen.getByLabelText('Search accounts'), 'ada')
    fireEvent.press(screen.getByRole('button', { name: 'Pick Ada' }))
    fireEvent.press(screen.getByRole('button', { name: 'Create organisation' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/admin/organizations', { name: 'New Co', description: null, leader_user_id: 'a1' })
    )
    expect(mockBack).toHaveBeenCalled()
  })
})
