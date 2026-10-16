import { act, renderHook, waitFor } from '@testing-library/react-native'
import { ActingOrgProvider, useActingOrg } from '../../../lib/acting-org'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: (...a: unknown[]) => mockGetItem(...a), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'a', name: 'Northside' }, { id: 'b', name: 'Westside' }] }, loading: false, refresh: jest.fn() }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => <ActingOrgProvider>{children}</ActingOrgProvider>

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('useActingOrg when storage fails', () => {
  it('uses the first organisation when the read fails', async () => {
    mockGetItem.mockRejectedValue(new Error('blocked'))
    const { result } = renderHook(() => useActingOrg(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.org?.id).toBe('a')
  })

  it('keeps a pick in memory when the write throws', async () => {
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockImplementation(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => useActingOrg(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setActingOrg('b'))
    expect(result.current.org?.id).toBe('b')
  })
})
