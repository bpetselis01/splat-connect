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

const steps = [
  { id: 'a', position: 1, title: 'Open the battery bay' },
  { id: 'b', position: 2, title: 'Slide the interrupter in' },
  { id: 'c', position: 3, title: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
})

describe('parseTicks', () => {
  it('keeps only ticks for steps the guide still has', () => {
    expect([...parseTicks('["a","gone","c"]', ['a', 'b', 'c'])]).toEqual(['a', 'c'])
  })
  it('starts empty on anything that is not a list of ids', () => {
    expect(parseTicks('{"a":1}', ['a']).size).toBe(0)
    expect(parseTicks('not json', ['a']).size).toBe(0)
    expect(parseTicks(null, ['a']).size).toBe(0)
  })
})

describe('stepProgress', () => {
  it('counts done, rounds the percent and points at the first open step', () => {
    expect(stepProgress(steps, new Set(['a']))).toEqual({ done: 1, total: 3, pct: 33, allDone: false, resume: steps[1] })
  })
  it('offers no resume before the first tick or after the last', () => {
    expect(stepProgress(steps, new Set()).resume).toBeNull()
    expect(stepProgress(steps, new Set(['a', 'b', 'c']))).toMatchObject({ pct: 100, allDone: true, resume: null })
  })
  it('never passes 100 when a stale tick is in the set', () => {
    expect(stepProgress(steps, new Set(['a', 'b', 'c', 'gone'])).pct).toBe(100)
  })
  it('is never all done with no steps', () => {
    expect(stepProgress([], new Set()).allDone).toBe(false)
  })
})

describe('useDeviceTicks', () => {
  const key = ticksKey('steps', 'g1')

  it('restores, toggles and saves under the guide’s key', async () => {
    mockGetItem.mockResolvedValue('["a"]')
    const { result } = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(result.current.ticked.has('a')).toBe(true))
    act(() => result.current.toggle('b'))
    expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g1.signed-out', '["a","b"]')
    act(() => result.current.reset())
    expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g1.signed-out', '[]')
  })

  it('keeps ticks in memory when the device store fails', async () => {
    mockGetItem.mockRejectedValue(new Error('keychain locked'))
    mockSetItem.mockRejectedValue(new Error('keychain locked'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useDeviceTicks(key, ['a']))
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => result.current.toggle('a'))
    await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
    expect(result.current.ticked.has('a')).toBe(true)
    spy.mockRestore()
  })

  it('starts empty when the stored value is corrupt', async () => {
    mockGetItem.mockResolvedValue('{{garbage')
    const { result } = renderHook(() => useDeviceTicks(key, ['a']))
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    expect(result.current.ticked.size).toBe(0)
  })
})
