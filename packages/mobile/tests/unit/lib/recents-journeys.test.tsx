import { renderHook, act, waitFor } from '@testing-library/react-native'
import { recordRecent, useRecents, parseRecents, resetRecentsCache, setRecentsOwner, recentsKeyFor } from '../../../lib/recents'

const RECENTS_KEY = recentsKeyFor('u1')

const mockDisk = new Map<string, string>()
const mockSetItem = jest.fn((k: string, v: string) => { mockDisk.set(k, v); return Promise.resolve() })
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (k: string) => Promise.resolve(mockDisk.get(k) ?? null),
    setItem: (k: string, v: string) => mockSetItem(k, v),
    removeItem: (k: string) => { mockDisk.delete(k); return Promise.resolve() },
  }),
}))

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'guide' as const, title: `T${id}`, subtitle: 's', href: `/guides/${id}` as const, ...over,
})
const saved = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `guide:${i}`, kind: 'guide', title: `T${i}`, subtitle: 's', href: `/guides/${i}`, at: i }))

beforeEach(() => {
  jest.clearAllMocks()
  mockDisk.clear()
  resetRecentsCache() // nothing left over to carry into the next owner
  setRecentsOwner(null)
  setRecentsOwner('u1')
  // The owner switch starts a read of an empty disk; each test writes its own first.
  resetRecentsCache()
  jest.useRealTimers()
})

describe('parseRecents on old or corrupt storage', () => {
  it.each([['an object', '{"a":1}'], ['a string', '"x"'], ['null', 'null'], ['truncated', '[{"key":'], ['empty', '']])(
    'gives an empty list for %s', (_l, raw) => expect(parseRecents(raw)).toEqual([]))

  it('keeps an object href (a typed route) and a string href, drops a missing or numeric one', () => {
    const base = { key: 'k', kind: 'toy', title: 't', subtitle: 's', at: 1 }
    const out = parseRecents(JSON.stringify([
      { ...base, key: 'a', href: '/x' },
      { ...base, key: 'b', href: { pathname: '/x', params: { id: '1' } } },
      { ...base, key: 'c' },
      { ...base, key: 'd', href: 7 },
      { ...base, key: 'e', href: null },
    ]))
    expect(out.map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('drops an entry with an unknown kind or a non-numeric timestamp', () => {
    const ok = { key: 'a', kind: 'guide', title: 't', subtitle: 's', href: '/g', at: 1 }
    expect(parseRecents(JSON.stringify([{ ...ok, kind: 'video' }, { ...ok, at: '1' }, { ...ok, title: null }]))).toEqual([])
  })

  it('caps what the device holds at ten, keeping the first ten', () => {
    const out = parseRecents(JSON.stringify(saved(25)))
    expect(out).toHaveLength(10)
    expect(out[0].key).toBe('guide:0')
  })
})

describe('recents journey', () => {
  it('re-opening something moves it to the top and does not grow the list', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => { recordRecent(item('a')); recordRecent(item('b')); recordRecent(item('c')); recordRecent(item('a')) })
    expect(result.current.recents.map((r) => r.key)).toEqual(['guide:a', 'guide:c', 'guide:b'])
  })

  it('the same id under two kinds are two entries', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => { recordRecent(item('1')); recordRecent(item('1', { kind: 'event' })) })
    expect(result.current.recents.map((r) => r.key)).toEqual(['event:1', 'guide:1'])
  })

  it('re-opening refreshes the title and subtitle, not just the position', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => { recordRecent(item('1', { title: 'Old name' })); recordRecent(item('1', { title: 'New name' })) })
    expect(result.current.recents).toHaveLength(1)
    expect(result.current.recents[0].title).toBe('New name')
  })

  it('stamps the time it was opened, newest strictly later', async () => {
    jest.useFakeTimers().setSystemTime(1_000)
    const { result } = renderHook(() => useRecents())
    await act(async () => { await Promise.resolve() })
    act(() => recordRecent(item('a')))
    jest.setSystemTime(5_000)
    act(() => recordRecent(item('b')))
    expect(result.current.recents.map((r) => r.at)).toEqual([5_000, 1_000])
  })

  it('the persisted JSON is what a cold start reads back, newest first', async () => {
    const a = renderHook(() => useRecents())
    await waitFor(() => expect(a.result.current.ready).toBe(true))
    act(() => { recordRecent(item('a')); recordRecent(item('b')) })
    await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
    a.unmount()
    resetRecentsCache()
    const b = renderHook(() => useRecents())
    await waitFor(() => expect(b.result.current.ready).toBe(true))
    expect(b.result.current.recents.map((r) => r.key)).toEqual(['guide:b', 'guide:a'])
  })

  it('a record made before the first read does not overwrite what the device already holds', async () => {
    mockDisk.set(RECENTS_KEY, JSON.stringify(saved(3)))
    act(() => recordRecent(item('fresh')))
    await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
    const written = JSON.parse(mockDisk.get(RECENTS_KEY) as string)
    expect(written.map((r: { key: string }) => r.key)).toEqual(['guide:fresh', 'guide:0', 'guide:1', 'guide:2'])
  })

  it('a stored entry the member re-opens before load is not duplicated', async () => {
    mockDisk.set(RECENTS_KEY, JSON.stringify(saved(3)))
    const { result } = renderHook(() => useRecents())
    act(() => recordRecent(item('1')))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.recents.map((r) => r.key)).toEqual(['guide:1', 'guide:0', 'guide:2'])
  })

  it('the cap holds when new records meet a full stored list', async () => {
    mockDisk.set(RECENTS_KEY, JSON.stringify(saved(10)))
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => recordRecent(item('new')))
    expect(result.current.recents).toHaveLength(10)
    expect(result.current.recents[0].key).toBe('guide:new')
    expect(result.current.recents.map((r) => r.key)).not.toContain('guide:9')
  })

  it('clear empties the list and the device', async () => {
    mockDisk.set(RECENTS_KEY, JSON.stringify(saved(3)))
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.clear())
    expect(result.current.recents).toEqual([])
    expect(mockDisk.get(RECENTS_KEY)).toBe('[]')
  })

  it('survives titles with quotes, angle brackets, emoji, RTL and 5000 characters', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const titles = ['O\'Brien "the" <b>&</b>', 'Sam 🧸🦄', 'سارة', 'x'.repeat(5000)]
    act(() => titles.forEach((t, i) => recordRecent(item(String(i), { title: t }))))
    await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
    expect(parseRecents(mockDisk.get(RECENTS_KEY) as string).map((r) => r.title).reverse()).toEqual(titles)
  })

  it('an id with colons does not collide with another kind', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => { recordRecent(item('toy:1')); recordRecent(item('1', { kind: 'toy' })) })
    // guide:toy:1 and toy:1 are different keys
    expect(new Set(result.current.recents.map((r) => r.key)).size).toBe(2)
  })

  it('a failed write keeps the list for this visit', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockSetItem.mockRejectedValueOnce(new Error('full'))
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => recordRecent(item('a')))
    await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
    expect(result.current.recents).toHaveLength(1)
  })
})

describe('one list per account', () => {
  it('each account sees only its own list, and switching back brings the first one back', async () => {
    const { result } = renderHook(() => useRecents())
    act(() => recordRecent(item('a')))
    await waitFor(() => expect(mockDisk.get(recentsKeyFor('u1'))).toContain('guide:a'))

    act(() => setRecentsOwner('u2'))
    const second = renderHook(() => useRecents())
    await waitFor(() => expect(second.result.current.ready).toBe(true))
    expect(second.result.current.recents).toEqual([])
    act(() => recordRecent(item('b')))
    await waitFor(() => expect(mockDisk.get(recentsKeyFor('u2'))).toContain('guide:b'))
    expect(mockDisk.get(recentsKeyFor('u1'))).not.toContain('guide:b')

    act(() => setRecentsOwner('u1'))
    const back = renderHook(() => useRecents())
    await waitFor(() => expect(back.result.current.recents.map((r) => r.key)).toEqual(['guide:a']))
    expect(result.current.recents.map((r) => r.key)).toEqual(['guide:a'])
  })

  it('signed out, nothing is written', async () => {
    act(() => setRecentsOwner(null))
    act(() => recordRecent(item('x')))
    await new Promise((r) => setTimeout(r, 20))
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it('the first account to load inherits the old shared list, which is then removed', async () => {
    mockDisk.set('home-recents', JSON.stringify(saved(2)))
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.recents).toHaveLength(2))
    expect(mockDisk.has('home-recents')).toBe(false)
    act(() => recordRecent(item('n')))
    await waitFor(() => expect(parseRecents(mockDisk.get(recentsKeyFor('u1')) ?? null)).toHaveLength(3))
  })

  it('a visit recorded before the session is read joins the account that then loads', async () => {
    act(() => setRecentsOwner(null))
    act(() => recordRecent(item('early')))
    act(() => setRecentsOwner('u3'))
    await waitFor(() => expect(mockDisk.get(recentsKeyFor('u3'))).toContain('guide:early'))
  })
})

it("an account's key is one iOS's secure store accepts (letters, digits, '.', '-', '_')", () => {
  expect(recentsKeyFor('4f1c2a9e-1d2b-4c3d-9e8f-0a1b2c3d4e5f')).toMatch(/^[A-Za-z0-9._-]+$/)
})
