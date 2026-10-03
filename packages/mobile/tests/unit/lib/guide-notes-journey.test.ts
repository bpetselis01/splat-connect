import { renderHook, act, waitFor } from '@testing-library/react-native'
import { noteSummary, pinCountLabel, stepLabel, useGuideNotes } from '../../../lib/guide-notes'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const note = (over: object) => ({
  id: 'n', step_position: 1, author_id: 'a', author_name: 'Priya', body: 'b', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const pinned = (over: object) => note({ pinned_at: '2026-09-02T00:00:00Z', pinned_by: 'o', pinned_by_name: 'Owen', ...over })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('useGuideNotes', () => {
  it('fetches the notes for this guide and exposes them', async () => {
    mockGet.mockResolvedValue([note({ id: 'n1' })])
    const { result } = renderHook(() => useGuideNotes('g-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials/g-1/notes')
  })

  it('shows no notes, and does not throw, when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('503'))
    const { result } = renderHook(() => useGuideNotes('g-1'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(result.current.notes).toEqual([])
  })

  it('keeps the notes already on screen when a reload fails', async () => {
    mockGet.mockResolvedValueOnce([note({ id: 'n1' })])
    const { result } = renderHook(() => useGuideNotes('g-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    mockGet.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await result.current.reload() })
    expect(result.current.notes).toHaveLength(1)
  })

  it('reload picks up a note posted after the first fetch', async () => {
    mockGet.mockResolvedValueOnce([])
    const { result } = renderHook(() => useGuideNotes('g-1'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    mockGet.mockResolvedValueOnce([note({ id: 'new' })])
    await act(async () => { await result.current.reload() })
    expect(result.current.notes.map((n) => n.id)).toEqual(['new'])
  })

  it('fetches again when the guide id changes', async () => {
    mockGet.mockResolvedValue([])
    const { rerender } = renderHook(({ id }: { id: string }) => useGuideNotes(id), { initialProps: { id: 'a' } })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials/a/notes'))
    rerender({ id: 'b' })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/tutorials/b/notes'))
  })
})

describe('noteSummary edges', () => {
  it('has nothing to label for a guide with no notes', () => {
    const s = noteSummary([], 5)
    expect(s.pinned).toEqual([])
    expect(s.open).toEqual([])
    expect(s.extras).toEqual([])
    expect(s.labels.size).toBe(0)
  })

  it('treats every note on a zero-step guide as a missing step, unlabeled', () => {
    const s = noteSummary([pinned({ id: 'p', step_position: 1, body: 'x' }), note({ id: 'o', step_position: 1 })], 0)
    expect(s.labels.size).toBe(0)
    expect(s.extras).toEqual([{ no: 1, body: 'x', by: 'Priya', pinnedBy: 'Owen' }])
    expect(stepLabel(note({ step_position: 1 }) as never, 0)).toBe('Missing step')
  })

  it('numbers extras after the last step in the order they were pinned', () => {
    const s = noteSummary(
      [pinned({ id: 'a', step_position: null, body: 'first' }), pinned({ id: 'b', step_position: 9, body: 'second' })],
      3
    )
    expect(s.extras.map((e) => [e.no, e.body])).toEqual([[4, 'first'], [5, 'second']])
  })

  it('says Deleted member when the pinning member is gone', () => {
    const s = noteSummary([pinned({ step_position: null, pinned_by_name: null })], 2)
    expect(s.extras[0].pinnedBy).toBe('Deleted member')
  })

  it('does not turn an unpinned missing-step note into an extra', () => {
    const s = noteSummary([note({ step_position: null })], 2)
    expect(s.extras).toEqual([])
    expect(s.open).toHaveLength(1)
  })

  it('treats the last step as a real step and one past it as missing', () => {
    expect(stepLabel(note({ step_position: 4 }) as never, 4)).toBe('Step 4')
    expect(stepLabel(note({ step_position: 5 }) as never, 4)).toBe('Missing step')
    expect(stepLabel(note({ step_position: null }) as never, 4)).toBe('Missing step')
  })

  it('joins pinned and discussion counts with a dot and pluralises each', () => {
    const s = noteSummary(
      [pinned({ id: '1', step_position: 2 }), pinned({ id: '2', step_position: 2 }), note({ id: '3', step_position: 2 })],
      3
    )
    expect(s.labels.get(2)).toBe('2 pinned revisions · 1 note')
    expect(pinCountLabel(1)).toBe('1 pinned revision')
    expect(pinCountLabel(0)).toBe('0 pinned revisions')
  })

  it('labels only the steps that have notes on a 150-step guide', () => {
    const s = noteSummary([note({ id: '1', step_position: 150 }), note({ id: '2', step_position: 77 }), note({ id: '3', step_position: 77 })], 150)
    expect([...s.labels.entries()]).toEqual([[77, '2 notes'], [150, '1 note']])
  })

  it('carries emoji, markup and very long bodies through untouched', () => {
    const body = `<b>🧸 "hi" & ${'x'.repeat(5000)}</b>`
    const s = noteSummary([pinned({ step_position: null, body, author_name: 'سارة' })], 1)
    expect(s.extras[0].body).toBe(body)
    expect(s.extras[0].by).toBe('سارة')
  })
})
