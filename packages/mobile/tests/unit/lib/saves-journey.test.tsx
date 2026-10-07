// journeys: G06
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { SAVE_SLUGS } from '@splat-connect/types'
import { useSaves } from '../../../lib/saves'

const mockGet = jest.fn(); const mockPost = jest.fn(); const mockDelete = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: {
  get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a),
}}))

const ids = (over: object = {}) => ({ tutorials: [], toys: [], challenges: [], organisations: [], parts: [], ...over })
const deferred = () => { let resolve!: (v?: unknown) => void; let reject!: (e: Error) => void; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(ids({ tutorials: ['t1'] }))
  mockPost.mockResolvedValue({}); mockDelete.mockResolvedValue({})
})

it('shows nothing saved, and does not throw, when the ids request fails', async () => {
  mockGet.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  expect(result.current.isSaved('tutorials', 't1')).toBe(false)
})

it('saves into the right bucket for every kind of thing', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  for (const slug of Object.keys(SAVE_SLUGS) as (keyof typeof SAVE_SLUGS)[]) {
    await act(async () => { await result.current.toggle(slug, 'x1') })
    expect(mockPost).toHaveBeenLastCalledWith('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: 'x1' })
    expect(result.current.isSaved(slug, 'x1')).toBe(true)
  }
  expect(mockPost).toHaveBeenCalledTimes(Object.keys(SAVE_SLUGS).length)
})

it('keeps the same id saved in one bucket and not another', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  expect(result.current.isSaved('toys', 't1')).toBe(false)
})

it('flips on screen before the request answers', async () => {
  const d = deferred()
  mockPost.mockReturnValue(d.promise)
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  let p!: Promise<void>
  act(() => { p = result.current.toggle('toys', 'toy-1') })
  expect(result.current.isSaved('toys', 'toy-1')).toBe(true)
  await act(async () => { d.resolve(); await p })
  expect(result.current.isSaved('toys', 'toy-1')).toBe(true)
})

it('puts an unsave back when the delete fails', async () => {
  mockDelete.mockRejectedValue(new Error('500'))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't1') })
  expect(result.current.isSaved('tutorials', 't1')).toBe(true)
})

it('a failed save on one id leaves a different id that was saved meanwhile alone', async () => {
  const slow = deferred()
  mockPost.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({})
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  let first!: Promise<void>
  act(() => { first = result.current.toggle('tutorials', 'a') })
  await act(async () => { await result.current.toggle('tutorials', 'b') })
  await act(async () => { slow.reject(new Error('429')); await first })
  expect(result.current.isSaved('tutorials', 'a')).toBe(false)
  expect(result.current.isSaved('tutorials', 'b')).toBe(true)
})

it('a double tap that fails both times ends where it started', async () => {
  mockPost.mockRejectedValue(new Error('down'))
  mockDelete.mockRejectedValue(new Error('down'))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  await act(async () => {
    await Promise.all([result.current.toggle('toys', 'z'), result.current.toggle('toys', 'z')])
  })
  expect(result.current.isSaved('toys', 'z')).toBe(false)
})

it('does not double-add an id the server already listed', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't1') })
  await act(async () => { await result.current.toggle('tutorials', 't1') })
  expect(result.current.savedIds.tutorials.filter((x) => x === 't1')).toHaveLength(1)
})

it('encodes nothing special: an id with odd characters goes in the path as given', async () => {
  mockGet.mockResolvedValue(ids({ tutorials: ['a b/ü'] }))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 'a b/ü')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 'a b/ü') })
  expect(mockDelete).toHaveBeenCalledWith('/api/saves/tutorials/a b/ü')
})

it('survives an ids answer from an older API that has no key for a newer kind', async () => {
  mockGet.mockResolvedValue({ tutorials: ['t1'], toys: [], challenges: [] })
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  expect(result.current.isSaved('parts', 'p1')).toBe(false)
  expect(result.current.isSaved('organisations', 'o1')).toBe(false)
})

describe('a tap before the saved list arrives', () => {
  it('keeps a save made while the list is still loading', async () => {
    const list = deferred()
    mockGet.mockReturnValue(list.promise)
    const { result } = renderHook(() => useSaves())
    await act(async () => { await result.current.toggle('tutorials', 'g1') })
    await act(async () => { list.resolve(ids({ tutorials: ['other'] })) })
    expect(result.current.isSaved('tutorials', 'g1')).toBe(true)
    expect(result.current.isSaved('tutorials', 'other')).toBe(true)
  })

  it('keeps an unsave made while the list is still loading, though the list still has it', async () => {
    const list = deferred()
    mockGet.mockReturnValue(list.promise)
    const { result } = renderHook(() => useSaves())
    await act(async () => { await result.current.toggle('tutorials', 'g1') })
    await act(async () => { await result.current.toggle('tutorials', 'g1') })
    await act(async () => { list.resolve(ids({ tutorials: ['g1'] })) })
    expect(result.current.isSaved('tutorials', 'g1')).toBe(false)
  })
})
