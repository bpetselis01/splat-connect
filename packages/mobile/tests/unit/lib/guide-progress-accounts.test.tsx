import { renderHook, act, waitFor } from '@testing-library/react-native'
import { setTicksOwner, ticksKey, useDeviceTicks } from '../../../lib/guide-progress'

const mockStore = new Map<string, string>()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => { mockStore.set(k, v) },
    removeItem: async (k: string) => { mockStore.delete(k) },
  }),
}))

beforeEach(() => mockStore.clear())
afterEach(() => setTicksOwner(null))

// Ticks are kept per account: on a shared phone the next account must not see
// which guides the last one built.
describe('step ticks across accounts on one device', () => {
  const tickAs = async (userId: string) => {
    setTicksOwner(userId)
    const hook = renderHook(() => useDeviceTicks(ticksKey('steps', 'g1'), ['a', 'b']))
    await waitFor(() => expect(hook.result.current.loaded).toBe(true))
    return hook
  }

  it('a second account on the same device starts with no ticks', async () => {
    const a = await tickAs('user-a')
    act(() => a.result.current.toggle('a'))
    a.unmount()

    const b = await tickAs('user-b')
    expect(b.result.current.ticked.size).toBe(0)
  })

  it('the first account finds its ticks again after another has used the phone', async () => {
    const a = await tickAs('user-a')
    act(() => a.result.current.toggle('a'))
    await waitFor(() => expect(mockStore.size).toBe(1))
    a.unmount()
    ;(await tickAs('user-b')).unmount()

    const again = await tickAs('user-a')
    await waitFor(() => expect(again.result.current.ticked.has('a')).toBe(true))
  })

  it('keeps each guide’s ticks apart', async () => {
    setTicksOwner('user-a')
    const one = renderHook(() => useDeviceTicks(ticksKey('steps', 'g1'), ['a']))
    await waitFor(() => expect(one.result.current.loaded).toBe(true))
    act(() => one.result.current.toggle('a'))

    const other = renderHook(() => useDeviceTicks(ticksKey('steps', 'g2'), ['a']))
    await waitFor(() => expect(other.result.current.loaded).toBe(true))
    expect(other.result.current.ticked.size).toBe(0)
  })

  it('keys stay within what the iPhone keychain accepts', () => {
    setTicksOwner('7f1c2a4e-0b8d-4a9e-9c51-2f6e1d3b8a70')
    expect(ticksKey('parts', '0b3e9c1a-5d2f-4e8b-a7c6-1f9d2e4b6a80')).toMatch(/^[A-Za-z0-9._-]+$/)
  })
})
