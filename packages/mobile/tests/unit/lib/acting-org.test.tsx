import { act, renderHook, waitFor } from '@testing-library/react-native'
import { ACTING_ORG_KEY, ActingOrgProvider, useActingOrg } from '../../../lib/acting-org'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockRemoveItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: (...a: unknown[]) => mockRemoveItem(...a),
  }),
}))

let mockOrgs: { id: string; name: string }[] = []
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { ledOrgs: mockOrgs }, loading: false, refresh: jest.fn() }),
}))

const A = { id: 'a', name: 'Northside' }
const B = { id: 'b', name: 'Westside' }
const wrapper = ({ children }: { children: React.ReactNode }) => <ActingOrgProvider>{children}</ActingOrgProvider>
const mount = () => renderHook(() => useActingOrg(), { wrapper })

beforeEach(() => {
  jest.clearAllMocks()
  mockOrgs = [A, B]
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
  mockRemoveItem.mockResolvedValue(undefined)
})

describe('useActingOrg', () => {
  it('returns the only organisation of a one-org leader', async () => {
    mockOrgs = [A]
    const { result } = mount()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.org).toEqual(A)
    expect(result.current.orgs).toEqual([A])
  })

  it('returns the first organisation when nothing is stored', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.org).toEqual(A)
  })

  it('returns a stored id the person still leads', async () => {
    mockGetItem.mockResolvedValue('b')
    const { result } = mount()
    await waitFor(() => expect(result.current.org).toEqual(B))
    expect(mockGetItem).toHaveBeenCalledWith(ACTING_ORG_KEY)
  })

  it('falls back to the first and clears a stored id the person no longer leads', async () => {
    mockGetItem.mockResolvedValue('gone')
    const { result } = mount()
    await waitFor(() => expect(mockRemoveItem).toHaveBeenCalledWith(ACTING_ORG_KEY))
    expect(result.current.org).toEqual(A)
  })

  it('returns null when the person leads nothing, and keeps the stored id', async () => {
    mockOrgs = []
    mockGetItem.mockResolvedValue('b')
    const { result } = mount()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.org).toBeNull()
    expect(mockRemoveItem).not.toHaveBeenCalled()
  })

  it('switches and stores the pick', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setActingOrg('b'))
    expect(result.current.org).toEqual(B)
    expect(mockSetItem).toHaveBeenCalledWith(ACTING_ORG_KEY, 'b')
  })
})
