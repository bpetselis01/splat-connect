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

  // Regression for a duplicate-child bug: id.current === null used to mean both
  // "no child yet" and "we never found out". A failed load must fall into the
  // second bucket and refuse to POST — a child may already exist on the server.
  it('does not POST after a failed load, and fails the save visibly instead', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.profile).toMatchObject({ age: 9 }) // optimistic value stays on screen
    expect(result.current.saveState).toBe('idle') // fails visibly, not a silent no-op
  })

  // Regression for a duplicate-child bug: the load's `.then` used to skip the
  // `id.current` assignment on unmount (`if (ignore) return`), so a write queued
  // before unmount and resolved after it had no id and POSTed a duplicate.
  it('does not POST after unmount, when a write was queued before the load resolved', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { resolveGet = r }))
    mockPatch.mockResolvedValue({})
    const { result, unmount } = renderHook(() => useChildProfile())
    act(() => { result.current.save({ age: 5 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    unmount()
    await act(async () => { resolveGet([{ id: 'cp1', age: 99 }]) })
    expect(mockPost).not.toHaveBeenCalled()
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 5 })))
  })

  // Regression for a lockout bug: a `loaded` ref set only by the mount effect
  // (never retried) meant one failed GET at mount permanently barred every
  // future save from POSTing, even once the network recovered. The fix
  // re-reads the collection instead of trusting a stale flag.
  it('recovers after a failed mount load once the account is reachable again', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // First save: the re-read also fails, so this fails visibly like any
    // other failed write — no POST, no PATCH.
    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPatch).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe('idle')

    // Network recovers: the account already has a child.
    mockGet.mockResolvedValue([{ id: 'cp1' }])
    mockPatch.mockResolvedValue({})
    act(() => { result.current.save({ age: 10 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 10 }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  // Regression for a duplicate-child bug: if a POST reaches the server but its
  // response is lost (timeout, dropped connection), the row still landed.
  // Re-reading before the next save's POST-vs-PATCH decision must find it
  // rather than POSTing a second child.
  it('does not duplicate when a POST lands but its response is lost', async () => {
    mockGet.mockResolvedValue([])
    mockPost.mockRejectedValueOnce(new Error('response lost'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(result.current.saveState).toBe('idle')

    // The row actually landed despite the lost response.
    mockGet.mockResolvedValue([{ id: 'created1' }])
    mockPatch.mockResolvedValue({})
    act(() => { result.current.save({ age: 8 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledTimes(1) // not called again
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/created1', expect.objectContaining({ age: 8 }))
  })

  it('does not re-read the collection when the mount load already found the id', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1' }])
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalledTimes(1)

    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockGet).toHaveBeenCalledTimes(1) // no extra read when id is already known
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 9 }))
  })

  it('does not POST twice when a second save arrives while the first POST is in flight', async () => {
    mockGet.mockResolvedValue([])
    let resolvePost: (v: unknown) => void = () => {}
    mockPost.mockReturnValue(new Promise((r) => { resolvePost = r }))
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    // POST is now in flight
    act(() => { result.current.save({ age: 8 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledTimes(1) // fails without the chain
    await act(async () => { resolvePost({ id: 'new1', age: 7 }) })
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/new1', expect.objectContaining({ age: 8 })))
  })

  describe('pinned to one child', () => {
    it('loads the named child, not the oldest', async () => {
      mockGet.mockResolvedValue([{ id: 'cp1', age: 5 }, { id: 'cp2', age: 9 }])
      const { result } = renderHook(() => useChildProfile('cp2'))
      await waitFor(() => expect(result.current.profile?.age).toBe(9))
    })

    it('PATCHes the pinned id and never creates, even when the load failed', async () => {
      // The one behaviour that separates pinned from the no-arg form: a list
      // handed this id out, so the row exists — a failed PATCH must not fork
      // a second child the way the no-arg form's create chain would.
      mockGet.mockRejectedValue(new Error('offline'))
      mockPatch.mockResolvedValue({})
      const { result } = renderHook(() => useChildProfile('cp2'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => result.current.save({ age: 4 }))
      await act(async () => { jest.advanceTimersByTime(300) })

      expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp2', expect.objectContaining({ age: 4 }))
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('shows null for an id the collection no longer holds', async () => {
      mockGet.mockResolvedValue([{ id: 'cp1', age: 5 }])
      const { result } = renderHook(() => useChildProfile('gone'))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.profile).toBeNull()
    })
  })
})
