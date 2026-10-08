import { renderHook, act, waitFor } from '@testing-library/react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  FEATURES,
  DEFAULT_HOME_IDS,
  homeKey,
  parseIds,
  useHomeShortcuts,
  resetHomeShortcutsCache,
} from '../../../lib/home-shortcuts'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: jest.fn(),
  }),
}))
let mockUser: string | null = 'u1'
jest.mock('../../../lib/auth-context', () => ({
  useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = 'u1'
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
  resetHomeShortcutsCache()
})

// An href is a real route when some file under app/ gives it: route groups
// vanish from the path and [param] segments match anything.
// The mobile tsconfig carries no node types, so fs/path come in untyped.
/* eslint-disable @typescript-eslint/no-require-imports */
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[] }
const path = require('path') as { join(...p: string[]): string }
declare const __dirname: string
const appDir = path.join(__dirname, '../../../app')
const routeFiles = (function walk(dir: string, rel: string[] = []): string[][] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(path.join(dir, e.name), [...rel, e.name])
      : /\.tsx?$/.test(e.name)
        ? [[...rel.filter((s) => !/^\(.*\)$/.test(s)), ...(e.name.replace(/\.tsx?$/, '') === 'index' ? [] : [e.name.replace(/\.tsx?$/, '')])]]
        : [],
  )
})(appDir)
const resolves = (href: string) => {
  const segs = href.split('?')[0].split('/').filter(Boolean)
  return routeFiles.some((r) => r.length === segs.length && r.every((s, i) => /^\[.*\]$/.test(s) || s === segs[i]))
}

describe('FEATURES', () => {
  // /printing/request needs ?guide= (it fetched tutorials/undefined and 404ed);
  // /printing explains that every request starts from a guide.
  it('sends Request a print where no guide is needed', () => {
    expect(FEATURES.find((f) => f.id === 'print')?.href).toBe('/printing')
  })

  it('sends Find a printer to the map with the Printers layer picked', () => {
    expect(FEATURES.find((f) => f.id === 'printers')?.href).toBe('/map?kind=printer')
  })

  it('has unique ids, real Ionicons names and hrefs that map to a route file', () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length)
    for (const f of FEATURES) {
      expect(Ionicons.glyphMap).toHaveProperty(f.icon)
      expect(typeof f.href).toBe('string')
      expect({ id: f.id, ok: resolves(f.href as string) }).toEqual({ id: f.id, ok: true })
    }
  })
  it('defaults to eight known ids', () => {
    expect(DEFAULT_HOME_IDS).toHaveLength(8)
    const ids = FEATURES.map((f) => f.id)
    for (const id of DEFAULT_HOME_IDS) expect(ids).toContain(id)
  })
})

describe('parseIds', () => {
  it('drops unknown ids and duplicates, keeps order', () => {
    expect(parseIds('["events","gone","guides","events"]')).toEqual(['events', 'guides'])
  })
  it('falls back to the defaults on missing or corrupt storage', () => {
    expect(parseIds(null)).toEqual(DEFAULT_HOME_IDS)
    expect(parseIds('nope')).toEqual(DEFAULT_HOME_IDS)
    expect(parseIds('{"a":1}')).toEqual(DEFAULT_HOME_IDS)
  })
  it('keeps an emptied Home empty', () => {
    expect(parseIds('[]')).toEqual([])
  })
})

describe('useHomeShortcuts', () => {
  it('starts on the defaults and becomes ready once storage is read', async () => {
    const { result } = renderHook(() => useHomeShortcuts())
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mockGetItem).toHaveBeenCalledWith(homeKey('u1'))
  })

  it('loads saved ids without adding newly shipped features', async () => {
    mockGetItem.mockResolvedValue('["events","gone"]')
    const { result } = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.ids).toEqual(['events'])
    expect(result.current.features.map((f) => f.id)).toEqual(['events'])
  })

  it('falls back to the defaults when the read throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetItem.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
  })

  it('adds, removes, moves and resets, saving each change under the user key', async () => {
    const { result } = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.add('learn'))
    expect(result.current.ids).toEqual([...DEFAULT_HOME_IDS, 'learn'])
    act(() => result.current.add('learn'))
    act(() => result.current.add('nope'))
    expect(result.current.ids).toHaveLength(9)
    act(() => result.current.remove('guides'))
    expect(result.current.ids).not.toContain('guides')
    act(() => result.current.move('learn', 0))
    expect(result.current.ids[0]).toBe('learn')
    act(() => result.current.moveToTop('makers'))
    expect(result.current.ids.slice(0, 2)).toEqual(['makers', 'learn'])
    expect(mockSetItem).toHaveBeenLastCalledWith(homeKey('u1'), JSON.stringify(result.current.ids))
    act(() => result.current.reset())
    expect(result.current.ids).toEqual(DEFAULT_HOME_IDS)
  })

  it('keeps the change in memory when the write fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockSetItem.mockRejectedValue(new Error('full'))
    const { result } = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.remove('guides'))
    expect(result.current.ids).not.toContain('guides')
  })

  it('keeps two components in sync and keys guests apart from users', async () => {
    const a = renderHook(() => useHomeShortcuts())
    const b = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(a.result.current.ready).toBe(true))
    act(() => a.result.current.remove('guides'))
    expect(b.result.current.ids).not.toContain('guides')
    mockUser = null
    const g = renderHook(() => useHomeShortcuts())
    await waitFor(() => expect(g.result.current.ready).toBe(true))
    expect(mockGetItem).toHaveBeenCalledWith('home-shortcuts.guest')
    expect(g.result.current.ids).toContain('guides')
  })
})
