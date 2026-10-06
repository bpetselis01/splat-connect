import { renderHook, act, waitFor } from '@testing-library/react-native'
import { parseTicks, stepProgress, ticksKey, useDeviceTicks } from '../../../lib/guide-progress'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: jest.fn(),
  }),
}))

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, position: i + 1, title: i % 2 ? null : `Step ${i + 1}` }))

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('ticksKey', () => {
  it('keeps steps and tools ticks apart for the same guide', () => {
    expect(ticksKey('steps', 'g')).not.toBe(ticksKey('tools', 'g'))
    expect(ticksKey('tools', 'g')).toBe('guide-tools.g.signed-out')
  })
})

describe('parseTicks edges', () => {
  it.each([
    ['empty string', ''],
    ['null', null],
    ['an object', '{"a":true}'],
    ['a bare string', '"a"'],
    ['a number', '42'],
    ['null literal', 'null'],
    ['truncated JSON', '["a","b'],
  ])('starts empty for %s', (_l, raw) => {
    expect(parseTicks(raw as string | null, ['a', 'b']).size).toBe(0)
  })

  it('drops non-string entries and ids the guide no longer has', () => {
    expect([...parseTicks('["a",1,null,["b"],"gone","b"]', ['a', 'b'])]).toEqual(['a', 'b'])
  })

  it('collapses duplicate ticks into one', () => {
    expect(parseTicks('["a","a","a"]', ['a']).size).toBe(1)
  })

  it('keeps nothing for a guide with no steps', () => {
    expect(parseTicks('["a"]', []).size).toBe(0)
  })
})

describe('stepProgress edges', () => {
  it('reports 0 of 0 with no resume and no percent for a zero-step guide', () => {
    expect(stepProgress([], new Set())).toEqual({ done: 0, total: 0, pct: 0, allDone: false, resume: null })
  })

  it('handles a one-step guide at both ends', () => {
    const one = many(1)
    expect(stepProgress(one, new Set())).toMatchObject({ done: 0, pct: 0, allDone: false, resume: null })
    expect(stepProgress(one, new Set(['s1']))).toMatchObject({ done: 1, pct: 100, allDone: true, resume: null })
  })

  it('rounds 1 of 3 to 33 and 2 of 3 to 67', () => {
    expect(stepProgress(many(3), new Set(['s1'])).pct).toBe(33)
    expect(stepProgress(many(3), new Set(['s1', 's2'])).pct).toBe(67)
  })

  it('resumes at the first untouched step of a 150-step guide, skipping ticks that are out of order', () => {
    const steps = many(150)
    const ticked = new Set(['s1', 's2', 's4', 's100'])
    const p = stepProgress(steps, ticked)
    expect(p.done).toBe(4)
    expect(p.resume?.id).toBe('s3')
    expect(p.pct).toBe(3)
  })

  it('counts a step twice in the list as two steps when both are ticked by id', () => {
    const dup = [{ id: 'a', position: 1, title: 'x' }, { id: 'a', position: 1, title: 'x' }]
    expect(stepProgress(dup, new Set(['a']))).toMatchObject({ done: 2, total: 2, allDone: true })
  })

  it('resume keeps the title the guide gave it, emoji included', () => {
    const steps = [{ id: 'a', position: 1, title: '🧸 <Open> & "close"' }, { id: 'b', position: 2, title: null }]
    expect(stepProgress(steps, new Set(['b'])).resume?.title).toBe('🧸 <Open> & "close"')
  })
})

describe('useDeviceTicks journeys', () => {
  const key = ticksKey('steps', 'g1')

  it('un-ticks a step when it is tapped twice, and writes the empty list', async () => {
    const { result } = renderHook(() => useDeviceTicks(key, ['a']))
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => result.current.toggle('a'))
    act(() => result.current.toggle('a'))
    expect(result.current.ticked.size).toBe(0)
    expect(mockSetItem).toHaveBeenLastCalledWith(key, '[]')
  })

  it('a tap that lands before the stored ticks are read is not undone by the read', async () => {
    let release!: (v: string | null) => void
    mockGetItem.mockReturnValue(new Promise((r) => { release = r }))
    const { result } = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    act(() => result.current.toggle('b'))
    await act(async () => { release('["a"]') })
    expect([...result.current.ticked]).toEqual(['b'])
  })

  it('ignores stored ids that are not in this guide any more', async () => {
    mockGetItem.mockResolvedValue('["old-step","a"]')
    const { result } = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(result.current.ticked.has('a')).toBe(true))
    expect(result.current.ticked.has('old-step')).toBe(false)
  })

  it('reads the new guide’s ticks when the key changes', async () => {
    mockGetItem.mockImplementation((k: string) => Promise.resolve(k === 'guide-steps.g2.signed-out' ? '["x"]' : '["a"]'))
    const { result, rerender } = renderHook(({ k, ids }: { k: string; ids: string[] }) => useDeviceTicks(k, ids), {
      initialProps: { k: key, ids: ['a'] },
    })
    await waitFor(() => expect(result.current.ticked.has('a')).toBe(true))
    rerender({ k: 'guide-steps.g2.signed-out', ids: ['x'] })
    await waitFor(() => expect(result.current.ticked.has('x')).toBe(true))
    expect(result.current.ticked.has('a')).toBe(false)
  })

  it('saves 150 ticks as one write', async () => {
    const ids = many(150).map((s) => s.id)
    const { result } = renderHook(() => useDeviceTicks(key, ids))
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    for (const id of ids) act(() => result.current.toggle(id))
    expect(result.current.ticked.size).toBe(150)
    expect(JSON.parse(mockSetItem.mock.lastCall![1])).toHaveLength(150)
  })

  it('reset clears the ticks on screen even when the device refuses the write', async () => {
    mockGetItem.mockResolvedValue('["a"]')
    mockSetItem.mockRejectedValue(new Error('full'))
    const { result } = renderHook(() => useDeviceTicks(key, ['a']))
    await waitFor(() => expect(result.current.ticked.has('a')).toBe(true))
    act(() => result.current.reset())
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(result.current.ticked.size).toBe(0)
  })

  it('does not set state from a read that finishes after unmount', async () => {
    let release!: (v: string | null) => void
    mockGetItem.mockReturnValue(new Promise((r) => { release = r }))
    const { unmount } = renderHook(() => useDeviceTicks(key, ['a']))
    unmount()
    await act(async () => { release('["a"]') })
    expect(console.error).not.toHaveBeenCalled()
  })
})
