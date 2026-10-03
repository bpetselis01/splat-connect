import { renderHook, act, waitFor } from '@testing-library/react-native'
import { DEFAULT_HOME_IDS, homeKey, parseIds, useHomeShortcuts, resetHomeShortcutsCache } from '../../../lib/home-shortcuts'

// A tiny in-memory device: what one user saves is what a later mount reads back.
const mockDisk = new Map<string, string>()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (k: string) => Promise.resolve(mockDisk.get(k) ?? null),
    setItem: (k: string, v: string) => { mockDisk.set(k, v); return Promise.resolve() },
    removeItem: jest.fn(),
  }),
}))
let mockUser: string | null = 'u1'
jest.mock('../../../lib/auth-context', () => ({
  useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }),
}))

beforeEach(() => {
  mockDisk.clear()
  mockUser = 'u1'
  resetHomeShortcutsCache()
})

const ready = async () => {
  const h = renderHook(() => useHomeShortcuts())
  await waitFor(() => expect(h.result.current.ready).toBe(true))
  return h
}

describe('parseIds on old or corrupt storage', () => {
  it.each([
    ['a JSON string', '"guides"'],
    ['a number', '42'],
    ['null', 'null'],
    ['an object', '{"0":"guides"}'],
    ['truncated JSON', '["guides","toy'],
    ['an empty string', ''],
    ['whitespace', '   '],
  ])('falls back to the defaults for %s', (_label, raw) => {
    expect(parseIds(raw)).toEqual(DEFAULT_HOME_IDS)
  })

  it('drops non-string entries but keeps the valid ones in order', () => {
    expect(parseIds('[1,null,"toys",{"a":1},["guides"],"events"]')).toEqual(['toys', 'events'])
  })

  it('keeps an emptied Home empty even when every stored id is unknown', () => {
    expect(parseIds('["retired","also-retired"]')).toEqual([])
  })

  it('does not honour prototype-ish ids', () => {
    expect(parseIds('["__proto__","constructor","toString"]')).toEqual([])
  })

  it('is case-sensitive: "Guides" is not "guides"', () => {
    expect(parseIds('["Guides"]')).toEqual([])
  })

  it('collapses a thousand duplicates to one', () => {
    expect(parseIds(JSON.stringify(Array(1000).fill('guides')))).toEqual(['guides'])
  })
})

describe('homeKey', () => {
  it('is per user, guest when signed out, and only uses SecureStore-safe characters', () => {
    expect(homeKey(null)).toBe('home-shortcuts.guest')
    expect(homeKey(undefined)).toBe('home-shortcuts.guest')
    expect(homeKey('3f2c-ab12')).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(homeKey('a')).not.toBe(homeKey('b'))
  })
})

describe('shortcut persistence journey', () => {
  it('a removed shortcut is still gone after the app restarts', async () => {
    const first = await ready()
    act(() => first.result.current.remove('guides'))
    first.unmount()
    resetHomeShortcutsCache() // a cold start: the in-memory copy is gone
    const second = await ready()
    expect(second.result.current.ids).not.toContain('guides')
    expect(second.result.current.ids).toHaveLength(DEFAULT_HOME_IDS.length - 1)
  })

  it('a reorder survives a restart', async () => {
    const first = await ready()
    act(() => first.result.current.move('makers', 0))
    const order = first.result.current.ids
    first.unmount()
    resetHomeShortcutsCache()
    expect((await ready()).result.current.ids).toEqual(order)
  })

  it('one member\'s changes never reach another member on the same phone', async () => {
    const a = await ready()
    act(() => a.result.current.remove('guides'))
    a.unmount()
    mockUser = 'u2'
    const b = await ready()
    expect(b.result.current.ids).toEqual(DEFAULT_HOME_IDS)
    act(() => b.result.current.add('learn'))
    mockUser = 'u1'
    const back = await ready()
    expect(back.result.current.ids).not.toContain('learn')
    expect(back.result.current.ids).not.toContain('guides')
  })

  it('signing out falls to the guest list, and back in restores the member list', async () => {
    const h = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(h.result.current.ready).toBe(true))
    act(() => h.result.current.remove('toys'))
    mockUser = null
    h.rerender({})
    await waitFor(() => expect(h.result.current.ready).toBe(true))
    expect(h.result.current.ids).toContain('toys')
    mockUser = 'u1'
    h.rerender({})
    await waitFor(() => expect(h.result.current.ids).not.toContain('toys'))
  })

  it('a change made before the first read lands wins over what the device held', async () => {
    mockDisk.set(homeKey('u1'), '["events"]')
    const h = renderHook(() => useHomeShortcuts())
    act(() => h.result.current.add('learn'))
    await waitFor(() => expect(h.result.current.ready).toBe(true))
    expect(h.result.current.ids).toContain('learn')
    expect(h.result.current.ids).toContain('guides') // the default list, not the stale one, was edited
  })
})

describe('edit operations at the edges', () => {
  it('removing a shortcut that is not there leaves the list as it was', async () => {
    const { result } = await ready()
    act(() => result.current.remove('nope'))
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
  })

  it('removing every shortcut leaves an empty grid, and Add still works after', async () => {
    const { result } = await ready()
    for (const id of DEFAULT_HOME_IDS) act(() => result.current.remove(id))
    expect(result.current.ids).toEqual([])
    expect(result.current.features).toEqual([])
    act(() => result.current.add('events'))
    expect(result.current.ids).toEqual(['events'])
    expect(JSON.parse(mockDisk.get(homeKey('u1')) as string)).toEqual(['events'])
  })

  it.each([
    ['below zero', -5, 0],
    ['past the end', 999, DEFAULT_HOME_IDS.length - 1],
    ['NaN', NaN, undefined],
  ])('move to a slot %s clamps rather than corrupting the list', async (_l, to, expectedIndex) => {
    const { result } = await ready()
    act(() => result.current.move('saves', to as number))
    expect([...result.current.ids].sort()).toEqual([...DEFAULT_HOME_IDS].sort())
    expect(new Set(result.current.ids).size).toBe(DEFAULT_HOME_IDS.length)
    if (expectedIndex !== undefined) expect(result.current.ids.indexOf('saves')).toBe(expectedIndex)
  })

  it('moving or topping an id that is not on Home does nothing', async () => {
    const { result } = await ready()
    act(() => { result.current.move('learn', 0); result.current.moveToTop('learn') })
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
  })

  it('adding twice in one tap-burst never duplicates', async () => {
    const { result } = await ready()
    act(() => { result.current.add('learn'); result.current.add('learn') })
    expect(result.current.ids.filter((x) => x === 'learn')).toHaveLength(1)
  })

  it('every add of an unknown id (including empty and whitespace) is ignored', async () => {
    const { result } = await ready()
    act(() => { result.current.add(''); result.current.add(' guides '); result.current.add('<b>x</b>') })
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
  })

  it('reset after an edit puts back the defaults and saves them', async () => {
    const { result } = await ready()
    act(() => result.current.remove('guides'))
    act(() => result.current.reset())
    expect(JSON.parse(mockDisk.get(homeKey('u1')) as string)).toEqual(DEFAULT_HOME_IDS)
  })

  it('drops a stored id for a feature that no longer ships from `features` as well as `ids`', async () => {
    mockDisk.set(homeKey('u1'), '["guides","retired","events"]')
    const { result } = await ready()
    expect(result.current.features.map((f) => f.id)).toEqual(['guides', 'events'])
  })
})
