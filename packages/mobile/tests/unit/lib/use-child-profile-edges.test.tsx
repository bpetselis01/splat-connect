// The child-profile autosave at its edges: the save indicator's states, rapid
// edits, clearing a field, serial writes, leaving the screen mid-edit; and the
// guides' read-only list of the parent's children.
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useChildProfile } from '../../../lib/use-child-profile'
import { useMyChildren } from '../../../lib/my-children'

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

function pending<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms) })

describe('useChildProfile, edges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockGet.mockResolvedValue([{ id: 'cp1', age: 5, name: 'Maya' }])
    mockPatch.mockResolvedValue({})
  })
  afterEach(() => jest.useRealTimers())

  async function ready(childId?: string) {
    const hook = renderHook(() => useChildProfile(childId))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('is idle before any edit, saving while the write is out, then saved', async () => {
    const slow = pending<object>()
    mockPatch.mockReturnValue(slow.promise)
    const { result } = await ready()
    expect(result.current.saveState).toBe('idle')
    act(() => result.current.save({ age: 6 }))
    expect(result.current.saveState).toBe('idle')
    await advance(300)
    expect(result.current.saveState).toBe('saving')
    await act(async () => slow.resolve({}))
    expect(result.current.saveState).toBe('saved')
  })

  it('a failed write goes back to idle, and the next good one says saved', async () => {
    mockPatch.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({})
    const { result } = await ready()
    act(() => result.current.save({ age: 6 }))
    await advance(300)
    expect(result.current.saveState).toBe('idle')
    act(() => result.current.save({ age: 7 }))
    await advance(300)
    expect(result.current.saveState).toBe('saved')
  })

  it('clearing a field sends null, not nothing', async () => {
    const { result } = await ready()
    act(() => result.current.save({ name: null }))
    await advance(300)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { name: null })
    expect(result.current.profile?.name).toBeNull()
  })

  it('a value changed three times in one burst goes out once, with the last value', async () => {
    const { result } = await ready()
    act(() => {
      result.current.save({ age: 6 })
      result.current.save({ age: 7 })
      result.current.save({ age: 8 })
    })
    await advance(300)
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { age: 8 })
  })

  it('each keystroke inside the window pushes the write back instead of sending a PATCH per letter', async () => {
    const { result } = await ready()
    for (const name of ['M', 'Ma', 'Mar', 'Mari']) {
      act(() => result.current.save({ name }))
      await advance(200)
    }
    expect(mockPatch).not.toHaveBeenCalled()
    await advance(100)
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { name: 'Mari' })
  })

  it('a second burst sends only its own fields, not the first burst again', async () => {
    const { result } = await ready()
    act(() => result.current.save({ age: 6 }))
    await advance(300)
    act(() => result.current.save({ press_force: 'light' }))
    await advance(300)
    expect(mockPatch).toHaveBeenNthCalledWith(1, '/api/child-profiles/cp1', { age: 6 })
    expect(mockPatch).toHaveBeenNthCalledWith(2, '/api/child-profiles/cp1', { press_force: 'light' })
  })

  it('writes go out one at a time, in order, even when the first is slow', async () => {
    const first = pending<object>()
    mockPatch.mockReturnValueOnce(first.promise).mockResolvedValueOnce({})
    const { result } = await ready()
    act(() => result.current.save({ age: 6 }))
    await advance(300)
    act(() => result.current.save({ age: 7 }))
    await advance(300)
    expect(mockPatch).toHaveBeenCalledTimes(1)
    await act(async () => first.resolve({}))
    expect(mockPatch).toHaveBeenCalledTimes(2)
    expect(mockPatch).toHaveBeenLastCalledWith('/api/child-profiles/cp1', { age: 7 })
  })

  it('leaving the screen inside the debounce window does not lose the edit', async () => {
    const { result, unmount } = await ready()
    act(() => result.current.save({ name: 'Zoë 🧸' }))
    unmount()
    await advance(300)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { name: 'Zoë 🧸' })
  })

  it('an account whose list read answers nothing at all is a null profile, not a crash', async () => {
    mockGet.mockResolvedValue(null)
    const { result } = await ready()
    expect(result.current.profile).toBeNull()
  })

  it('markup and emoji in a value reach the API untouched', async () => {
    const { result } = await ready()
    act(() => result.current.save({ name: `<b>"O'Brien"</b> 🧸 & سارة` }))
    await advance(300)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { name: `<b>"O'Brien"</b> 🧸 & سارة` })
  })

  it('a pinned child that was deleted elsewhere is a null profile, and saving to it never creates one', async () => {
    mockGet.mockResolvedValue([{ id: 'other' }])
    mockPatch.mockRejectedValue(new Error('404'))
    const { result } = await ready('gone')
    expect(result.current.profile).toBeNull()
    act(() => result.current.save({ age: 3 }))
    await advance(300)
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe('idle')
  })
})

describe('useMyChildren', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts empty, then holds the parent\'s children', async () => {
    mockGet.mockResolvedValue([{ id: 'a', name: 'Maya' }, { id: 'b', name: 'Sam' }])
    const { result } = renderHook(() => useMyChildren())
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(mockGet).toHaveBeenCalledWith('/api/child-profiles')
  })

  it.each([
    ['a network failure', () => mockGet.mockRejectedValue(new Error('offline'))],
    ['a 401', () => mockGet.mockRejectedValue({ status: 401 })],
    ['a childless account', () => mockGet.mockResolvedValue([])],
  ])('stays empty, never throwing, on %s', async (_l, arrange) => {
    arrange()
    const { result } = renderHook(() => useMyChildren())
    await act(async () => {})
    expect(result.current).toEqual([])
  })

  it('a read that lands after the screen is gone changes nothing and does not warn', async () => {
    const slow = pending<unknown[]>()
    mockGet.mockReturnValue(slow.promise)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useMyChildren())
    unmount()
    await act(async () => slow.resolve([{ id: 'a' }]))
    expect(result.current).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
