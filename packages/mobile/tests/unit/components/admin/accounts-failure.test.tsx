import { render, screen, fireEvent } from '@testing-library/react-native'
import { AccountsScreen } from '../../../../components/admin/accounts-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: (_t: string, _m: string, _l: string, ok: () => void) => ok() }))

const err = (status: number, text: string) => Object.assign(new Error(`failed with status ${status}: ${text}`), { status })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGet.mockResolvedValue({ accounts: [{ id: 'a1', name: 'Ada', email: 'ada@example.com', role: 'contributor', created_at: '2026-03-01T00:00:00Z' }], total: 1 })
})

describe('AccountsScreen failures', () => {
  it('shows "Admins only" when the list is forbidden', async () => {
    mockGet.mockRejectedValue(err(403, 'Forbidden'))
    render(<AccountsScreen />)
    expect(await screen.findByText('Admins only')).toBeTruthy()
  })

  it('shows the sole-leader copy on a delete 409 and keeps the row', async () => {
    mockDelete.mockRejectedValue(err(409, 'Hand over their organisation first.'))
    render(<AccountsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Delete Ada' }))
    expect(await screen.findByText('Make someone else a leader first.')).toBeTruthy()
    expect(screen.getByText('Ada')).toBeTruthy()
  })

  it('shows "Admins only." when the delete is forbidden', async () => {
    mockDelete.mockRejectedValue(err(403, 'Forbidden'))
    render(<AccountsScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Delete Ada' }))
    expect(await screen.findByText('Admins only.')).toBeTruthy()
  })

  it('offline: says so, logs nothing, and Try again fetches it again', async () => {
    mockGet.mockReset()
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<AccountsScreen />)
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
    mockGet.mockResolvedValue({ accounts: [{ id: 'a9', name: 'Back again', email: 'b@example.com', role: 'contributor', created_at: '2026-03-01T00:00:00Z' }], total: 1 })
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back again')).toBeTruthy()
  })
})
