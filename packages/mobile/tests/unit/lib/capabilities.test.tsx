import { renderHook, waitFor } from '@testing-library/react-native'
import { useCapabilities } from '../../../lib/capabilities'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
// A stable session reference: useCapabilities' refresh is memoized on `session`
// via useCallback, and a fresh object literal on every useAuth() call would
// retrigger the effect on every render — an infinite refetch loop that starves
// act()'s flush and is the real source of the "not wrapped in act" noise, not
// the hook itself.
const stableSession = { session: { user: { id: 'u1' } } }
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => stableSession }))

const profile = { id: 'u1', name: 'B', email: 'b@x', role: 'contributor', public_showcase: true, created_at: '' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/contributors/me') return Promise.resolve(profile)
    if (path === '/api/organizations/mine') return Promise.resolve([{ id: 'o1', name: 'Alpha' }])
    if (path === '/api/notifications/me/unread-counts') return Promise.resolve({ tutorials: 1, exchanges: 2, challenges: 0, total: 3 })
    if (path === '/api/toy-transactions/action-count') return Promise.resolve({ count: 4 })
    return Promise.reject(new Error(path))
  })
})

it('assembles capabilities from the four rail endpoints', async () => {
  const { result } = renderHook(() => useCapabilities())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.caps).toEqual({
    profile, isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Alpha' }],
    unread: { tutorials: 1, exchanges: 2, challenges: 0, total: 3 }, exchangeActions: 4,
  })
})

it('degrades each optional endpoint to its empty value, not to null caps', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/contributors/me' ? Promise.resolve(profile) : Promise.reject(new Error('down')))
  const { result } = renderHook(() => useCapabilities())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.caps?.ledOrgs).toEqual([])
  expect(result.current.caps?.unread.total).toBe(0)
  expect(result.current.caps?.exchangeActions).toBe(0)
})
