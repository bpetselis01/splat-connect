import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AccountsScreen } from '../../../../components/admin/accounts-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
// The confirm dialog is the platform's; the test answers yes.
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: (_t: string, _m: string, _l: string, ok: () => void) => ok() }))

const acct = (id: string, name: string) => ({ id, name, email: `${name.toLowerCase()}@example.com`, role: 'contributor', created_at: '2026-03-01T00:00:00Z' })

beforeEach(() => {
  jest.clearAllMocks()
  mockDelete.mockResolvedValue(undefined)
  mockGet.mockResolvedValue({ accounts: [acct('a1', 'Ada'), acct('a2', 'Bo')], total: 2 })
})

describe('AccountsScreen', () => {
  it('filters by name or email as you type', async () => {
    render(<AccountsScreen />)
    expect(await screen.findByText('Ada')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Search accounts'), 'bo@')
    expect(screen.queryByText('Ada')).toBeNull()
    expect(screen.getByText('Bo')).toBeTruthy()
  })

  it('deletes an account after the confirm and drops its row', async () => {
    render(<AccountsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Delete Ada' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/admin/contributors/a1'))
    await waitFor(() => expect(screen.queryByText('Ada')).toBeNull())
  })

  it('says how many are shown when the API capped the list', async () => {
    mockGet.mockResolvedValue({ accounts: [acct('a1', 'Ada')], total: 1432 })
    render(<AccountsScreen />)
    expect(await screen.findByText(/Showing first 1 of 1432/)).toBeTruthy()
  })

  it('shows an EmptyState with no accounts', async () => {
    mockGet.mockResolvedValue({ accounts: [], total: 0 })
    render(<AccountsScreen />)
    expect(await screen.findByText('No accounts yet.')).toBeTruthy()
  })
})
