import { renderHook, act, waitFor } from '@testing-library/react-native'
import { ticksKey, useDeviceTicks } from '../../../lib/guide-progress'

const mockStore = new Map<string, string>()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => { mockStore.set(k, v) },
    removeItem: async (k: string) => { mockStore.delete(k) },
  }),
}))

beforeEach(() => mockStore.clear())

// Ticks are kept per device and guide, not per account: the key carries no
// user id and nothing clears them on sign-out. These tests pin that behaviour.
describe('step ticks across accounts on one device', () => {
  const key = ticksKey('steps', 'g1')

  it('a second account on the same device reads the first account’s ticks', async () => {
    const accountA = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(accountA.result.current.loaded).toBe(true))
    act(() => accountA.result.current.toggle('a'))
    accountA.unmount()

    const accountB = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(accountB.result.current.ticked.has('a')).toBe(true))
  })

  it('keeps each guide’s ticks apart', async () => {
    const one = renderHook(() => useDeviceTicks(ticksKey('steps', 'g1'), ['a']))
    await waitFor(() => expect(one.result.current.loaded).toBe(true))
    act(() => one.result.current.toggle('a'))

    const other = renderHook(() => useDeviceTicks(ticksKey('steps', 'g2'), ['a']))
    await waitFor(() => expect(other.result.current.loaded).toBe(true))
    expect(other.result.current.ticked.size).toBe(0)
  })

  it('a reset by one account clears the ticks for the next', async () => {
    mockStore.set(key, '["a","b"]')
    const first = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(first.result.current.ticked.size).toBe(2))
    act(() => first.result.current.reset())
    first.unmount()

    const next = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(next.result.current.loaded).toBe(true))
    expect(next.result.current.ticked.size).toBe(0)
  })
})
