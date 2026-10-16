import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrganisationsScreen } from '../../../../components/admin/organisations-screen'
import { OrganisationManageScreen } from '../../../../components/admin/organisation-manage-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn(), delete: jest.fn() },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn(), back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const err = (status: number, text: string) => Object.assign(new Error(`failed with status ${status}: ${text}`), { status })
const accounts = { accounts: [{ id: 'a1', name: 'Ada', email: 'ada@example.com', role: 'contributor', created_at: '2026-03-01T00:00:00Z' }], total: 1 }

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGet.mockImplementation((path: string) => Promise.resolve(path === '/api/organizations' ? [] : accounts))
})

describe('organisations failures', () => {
  it('shows "Admins only" when the accounts read is forbidden', async () => {
    mockGet.mockImplementation((path: string) => (path === '/api/organizations' ? Promise.resolve([]) : Promise.reject(err(403, 'Forbidden'))))
    render(<OrganisationsScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows "Admins only" on the create screen too', async () => {
    mockGet.mockRejectedValue(err(403, 'Forbidden'))
    render(<OrganisationManageScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('blocks Create without a name and a first leader', async () => {
    render(<OrganisationManageScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Create organisation' }))
    expect(await screen.findByText('Give it a name and pick a first leader.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows the server sentence word for word when create fails', async () => {
    mockPost.mockRejectedValue(err(400, 'an org leader must have the contributor role'))
    render(<OrganisationManageScreen />)
    fireEvent.changeText(await screen.findByLabelText('Name'), 'New Co')
    fireEvent.changeText(screen.getByLabelText('Search accounts'), 'ada')
    fireEvent.press(screen.getByRole('button', { name: 'Pick Ada' }))
    fireEvent.press(screen.getByRole('button', { name: 'Create organisation' }))
    expect(await screen.findByText('an org leader must have the contributor role')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('says so when the organisation is gone', async () => {
    render(<OrganisationManageScreen orgId="missing" />)
    expect(await screen.findByText("That organisation isn't here any more.")).toBeTruthy()
  })

  it('offline: says so, logs nothing, and Try again fetches it again', async () => {
    mockGet.mockReset()
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<OrganisationsScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
    mockGet.mockImplementation((path: string) => Promise.resolve(path === '/api/organizations' ? [{ id: 'o1', name: 'Back again', status: 'active', org_leaders: [] }] : accounts))
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back again')).toBeTruthy()
  })
})
