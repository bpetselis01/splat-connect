import { renderHook, waitFor } from '@testing-library/react-native'
import { act } from '@testing-library/react-native'
import { invalidateCapabilities, useCapabilities } from '../../../lib/capabilities'

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
    if (path === '/api/notifications/me/unread-counts') return Promise.resolve({ tutorials: 1, exchanges: 2, challenges: 0, organisations: 0, total: 3 })
    if (path === '/api/toy-transactions/action-count') return Promise.resolve({ count: 4 })
    return Promise.reject(new Error(path))
  })
})

it('assembles capabilities from the four rail endpoints', async () => {
  const { result } = renderHook(() => useCapabilities())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.caps).toEqual({
    profile, isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Alpha' }],
    unread: { tutorials: 1, exchanges: 2, challenges: 0, organisations: 0, total: 3 }, exchangeActions: 4,
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

// The tab bar, Home's Today card and Me each hold their own copy, so a count
// that changes (a notification read in the Inbox) must reach every one.
it('refetches in every mounted hook when the counts are invalidated', async () => {
  const bar = renderHook(() => useCapabilities())
  const today = renderHook(() => useCapabilities())
  await waitFor(() => expect(bar.result.current.caps?.unread.total).toBe(3))
  await waitFor(() => expect(today.result.current.caps?.unread.total).toBe(3))
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/contributors/me') return Promise.resolve(profile)
    if (path === '/api/notifications/me/unread-counts') return Promise.resolve({ tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 })
    return Promise.resolve(path === '/api/organizations/mine' ? [] : { count: 0 })
  })
  act(() => invalidateCapabilities())
  await waitFor(() => expect(bar.result.current.caps?.unread.total).toBe(0))
  await waitFor(() => expect(today.result.current.caps?.unread.total).toBe(0))
})
