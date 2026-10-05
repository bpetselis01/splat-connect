import { renderHook, act, waitFor } from '@testing-library/react-native'
import { recordRecent, useRecents, parseRecents, resetRecentsCache, setRecentsOwner, recentsKeyFor } from '../../../lib/recents'

const RECENTS_KEY = recentsKeyFor('u1')

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: jest.fn(),
  }),
}))

const item = (id: string, kind: 'guide' | 'toy' = 'guide') => ({
  id,
  kind,
  title: `T${id}`,
  subtitle: 's',
  href: `/guides/${id}` as const,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
  resetRecentsCache() // nothing left over to carry into the next owner
  setRecentsOwner(null)
  setRecentsOwner('u1')
  // The owner switch starts a read of an empty disk; each test writes its own first.
  resetRecentsCache()
})

describe('parseRecents', () => {
  it('drops malformed entries and survives corrupt storage', () => {
    const ok = { key: 'guide:1', kind: 'guide', title: 'a', subtitle: 'b', href: '/guides/1', at: 1 }
    expect(parseRecents(JSON.stringify([ok, { kind: 'x' }, 3]))).toEqual([ok])
    expect(parseRecents('nope')).toEqual([])
    expect(parseRecents(null)).toEqual([])
  })
})

describe('recents', () => {
  it('records newest first, de-duplicated by kind+id, capped at 10, and persists', async () => {
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => {
      for (let i = 0; i < 12; i++) recordRecent(item(String(i)))
      recordRecent(item('5'))
      recordRecent(item('5', 'toy'))
    })
    const keys = result.current.recents.map((r) => r.key)
    expect(keys).toHaveLength(10)
    expect(keys.slice(0, 3)).toEqual(['toy:5', 'guide:5', 'guide:11'])
    expect(keys.filter((k) => k === 'guide:5')).toHaveLength(1)
    await waitFor(() => expect(mockSetItem).toHaveBeenLastCalledWith(RECENTS_KEY, expect.any(String)))
  })

  it('merges what the device holds beneath a record made before the read landed', async () => {
    const saved = { key: 'guide:old', kind: 'guide', title: 'o', subtitle: 's', href: '/guides/old', at: 1 }
    mockGetItem.mockResolvedValue(JSON.stringify([saved]))
    const { result } = renderHook(() => useRecents())
    act(() => recordRecent(item('new')))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.recents.map((r) => r.key)).toEqual(['guide:new', 'guide:old'])
  })

  it('starts empty on a failed read and clears', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetItem.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useRecents())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.recents).toEqual([])
    act(() => recordRecent(item('1')))
    act(() => result.current.clear())
    expect(result.current.recents).toEqual([])
  })
})
