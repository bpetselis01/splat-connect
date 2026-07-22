import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useChildProfile } from '../../../lib/use-child-profile'

const mockGet = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) } }))

describe('useChildProfile', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
  afterEach(() => jest.useRealTimers())

  it('loads the child profile on mount', async () => {
    mockGet.mockResolvedValue({ id: 'cp1', age: 5 })
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.profile?.age).toBe(5))
    expect(mockGet).toHaveBeenCalledWith('/api/child-profile')
  })

  it('save merges optimistically and debounces one PUT', async () => {
    mockGet.mockResolvedValue(null)
    mockPut.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }); result.current.save({ macs_level: 'II' }) })
    expect(result.current.profile).toMatchObject({ age: 7, macs_level: 'II' }) // optimistic
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPut).toHaveBeenCalledTimes(1) // debounced
    expect(mockPut).toHaveBeenCalledWith('/api/child-profile', expect.objectContaining({ age: 7, macs_level: 'II' }))
  })

  it('falls back to a null profile when the initial load fails', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
  })

  it('keeps the optimistic value when the PUT fails', async () => {
    mockGet.mockResolvedValue(null)
    mockPut.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(result.current.profile).toMatchObject({ age: 9 }) // optimistic value survives a failed save
  })
})
