import { renderHook, waitFor, act } from '@testing-library/react-native'
import { invalidateCapabilities, useCapabilities } from '../../../lib/capabilities'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))

const profile = (role: string) => ({ id: 'u1', name: 'B', email: 'b@x', role })
const serve = (over: Record<string, unknown> = {}) =>
  mockGet.mockImplementation((path: string) => {
    const table: Record<string, unknown> = {
      '/api/contributors/me': profile('contributor'),
      '/api/organizations/mine': [],
      '/api/notifications/me/unread-counts': { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
      '/api/toy-transactions/action-count': { count: 0 },
      ...over,
    }
    const v = table[path]
    return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = { user: { id: 'u1' } }
  serve()
})

describe('useCapabilities edges', () => {
  it('an admin profile sets isAdmin; any other role does not', async () => {
    serve({ '/api/contributors/me': profile('admin') })
    const a = renderHook(() => useCapabilities())
    await waitFor(() => expect(a.result.current.loading).toBe(false))
    expect(a.result.current.caps?.isAdmin).toBe(true)
    serve({ '/api/contributors/me': profile('Admin') })
    const b = renderHook(() => useCapabilities())
    await waitFor(() => expect(b.result.current.loading).toBe(false))
    expect(b.result.current.caps?.isAdmin).toBe(false)
  })

  it('when the profile call fails the caps are null (so no admin row, no badges), not half-built', async () => {
    serve({ '/api/contributors/me': new Error('500') })
    const { result } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.caps).toBeNull()
  })

  it('signed out: no calls are made and caps are null', async () => {
    mockSession = null
    const { result } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.caps).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('signing out after signing in clears the caps', async () => {
    const { result, rerender } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.caps).not.toBeNull())
    mockSession = null
    rerender({})
    await waitFor(() => expect(result.current.caps).toBeNull())
  })

  it('each of the three optional calls failing alone only costs its own count', async () => {
    serve({
      '/api/organizations/mine': [{ id: 'o1', name: 'Alpha' }],
      '/api/notifications/me/unread-counts': new Error('x'),
      '/api/toy-transactions/action-count': { count: 6 },
    })
    const { result } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.caps?.ledOrgs).toHaveLength(1)
    expect(result.current.caps?.unread.total).toBe(0)
    expect(result.current.caps?.exchangeActions).toBe(6)
  })

  it('a huge unread total comes through whole (capping to 99+ is the tab bar\'s job)', async () => {
    serve({ '/api/notifications/me/unread-counts': { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 5000 } })
    const { result } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.caps?.unread.total).toBe(5000))
  })

  it('unmounting removes the hook from the invalidation set', async () => {
    const { result, unmount } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    mockGet.mockClear()
    act(() => invalidateCapabilities())
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('refresh() re-reads and picks up a changed count', async () => {
    const { result } = renderHook(() => useCapabilities())
    await waitFor(() => expect(result.current.loading).toBe(false))
    serve({ '/api/toy-transactions/action-count': { count: 9 } })
    await act(async () => { await result.current.refresh() })
    expect(result.current.caps?.exchangeActions).toBe(9)
  })
})
