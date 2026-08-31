// packages/mobile/tests/unit/components/toys/organisations-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrganisationsScreen } from '../../../../components/toys/organisations-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as
// toy-library-screen.test.tsx.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const org = (over: object) => ({
  id: 'org1',
  name: 'TAD Australia',
  description: null,
  status: 'active',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
})

describe('OrganisationsScreen', () => {
  it('renders org names from the public organizations endpoint', async () => {
    mockGet.mockResolvedValue([org({ id: 'o1', name: 'TAD Australia' }), org({ id: 'o2', name: 'Riverside Therapy' })])
    render(<OrganisationsScreen />)
    expect(await screen.findByText('TAD Australia')).toBeTruthy()
    expect(screen.getByText('Riverside Therapy')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/organizations')
  })

  it('excludes suspended organisations', async () => {
    mockGet.mockResolvedValue([
      org({ id: 'o1', name: 'TAD Australia', status: 'active' }),
      org({ id: 'o2', name: 'Old Org', status: 'suspended' }),
    ])
    render(<OrganisationsScreen />)
    await screen.findByText('TAD Australia')
    expect(screen.queryByText('Old Org')).toBeNull()
  })

  it('navigates to the org showcase route on row press', async () => {
    mockGet.mockResolvedValue([org({ id: 'o1', name: 'TAD Australia' })])
    render(<OrganisationsScreen />)
    const row = await screen.findByLabelText('TAD Australia')
    fireEvent.press(row)
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisation/o1')
  })

  it('shows an error message when apiClient.get rejects, and retries', async () => {
    mockGet.mockRejectedValueOnce(new Error('API GET failed with status 500'))
    render(<OrganisationsScreen />)
    expect(await screen.findByText("Couldn't load organisations.")).toBeTruthy()
    mockGet.mockResolvedValue([org({ id: 'o1', name: 'TAD Australia' })])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('TAD Australia')).toBeTruthy()
  })

  it('shows an empty state when there are no active organisations', async () => {
    mockGet.mockResolvedValue([])
    render(<OrganisationsScreen />)
    expect(await screen.findByText('No organisations yet')).toBeTruthy()
  })
})
