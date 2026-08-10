import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useChildProfile } from '../../../lib/use-child-profile'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
  },
}))

describe('useChildProfile', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
  afterEach(() => jest.useRealTimers())

  // Mobile shows one child. The collection is ordered oldest-first by the API,
  // so the first entry is that child.
  it('loads the first child on mount', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1', age: 5 }, { id: 'cp2', age: 9 }])
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.profile?.age).toBe(5))
    expect(mockGet).toHaveBeenCalledWith('/api/child-profiles')
  })

  it('save merges optimistically and debounces one PATCH', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1', age: 1 }])
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }); result.current.save({ macs_level: 'II' }) })
    expect(result.current.profile).toMatchObject({ age: 7, macs_level: 'II' }) // optimistic
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPatch).toHaveBeenCalledTimes(1) // debounced
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 7, macs_level: 'II' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe('saved') // confirmed to the user
  })

  it('POSTs the first save when the account has no child yet', async () => {
    mockGet.mockResolvedValue([])
    mockPost.mockResolvedValue({ id: 'new1', age: 7 })
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', expect.objectContaining({ age: 7 }))
    expect(result.current.saveState).toBe('saved')
  })

  // Chain: the old PUT was an upsert, so a repeat save was harmless. POST is not
  //        idempotent — without the id from the first response, the second save
  //        would create a second child.
  it('PATCHes the child the first save created rather than POSTing again', async () => {
    mockGet.mockResolvedValue([])
    mockPost.mockResolvedValue({ id: 'new1', age: 7 })
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    act(() => { result.current.save({ age: 8 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/new1', expect.objectContaining({ age: 8 }))
  })

  it('falls back to a null profile when the initial load fails', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
  })

  it('keeps the optimistic value when the write fails', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1' }])
    mockPatch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(result.current.profile).toMatchObject({ age: 9 }) // optimistic value survives a failed save
    expect(result.current.saveState).toBe('idle') // never a false "saved" on failure
  })

  it('does not let a slow initial load clobber an edit made before it resolves', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { resolveGet = r }))
    const { result } = renderHook(() => useChildProfile())
    // User edits before the mount GET has resolved.
    act(() => { result.current.save({ age: 5 }) })
    expect(result.current.profile).toMatchObject({ age: 5 })
    // The (now stale) initial load resolves with server data.
    await act(async () => { resolveGet([{ id: 'cp1', age: 99 }]) })
    // The in-progress edit must win — the load must not overwrite it.
    expect(result.current.profile).toMatchObject({ age: 5 })
  })

  // Chain: without queueing writes behind the load, a save fired mid-load has no
  //        id yet and would POST a second child alongside the one being loaded.
  it('waits for the load before writing, so an early save patches rather than duplicates', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { resolveGet = r }))
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    act(() => { result.current.save({ age: 5 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).not.toHaveBeenCalled()
    await act(async () => { resolveGet([{ id: 'cp1', age: 99 }]) })
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 5 })))
    expect(mockPost).not.toHaveBeenCalled()
  })
})
