import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useLearnProgress, LEARN_PROGRESS_KEY } from '../../../lib/learn'
import { LEARN_ARTICLES } from '../../../lib/learn-content'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: jest.fn(),
  }),
}))

// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — standing in with a plain mount-time useEffect is
// enough to exercise the refetch-on-focus wiring itself, same as
// my-toys/list-screen.test.tsx. This file also stashes the latest effect so
// a test can invoke it a second time to stand in for a real refocus, which
// the screen-level stand-ins don't need since they only assert the mount call.
let latestFocusEffect: (() => void) | null = null
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useFocusEffect: (effect: () => void) => {
      latestFocusEffect = effect
      useEffect(effect, [])
    },
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  latestFocusEffect = null
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
})

describe('useLearnProgress', () => {
  it('starts empty when nothing is persisted', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(mockGetItem).toHaveBeenCalledWith(LEARN_PROGRESS_KEY))
    expect(result.current.read.size).toBe(0)
    expect(result.current.count).toBe(0)
    expect(result.current.next?.slug).toBe(LEARN_ARTICLES[0].slug)
  })

  it('restores persisted slugs on mount', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['switch-types', 'choosing-a-toy']))
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(result.current.count).toBe(2))
    expect(result.current.read.has('switch-types')).toBe(true)
    expect(result.current.read.has('choosing-a-toy')).toBe(true)
    // next = first article in LEARN_ARTICLES order not yet read
    expect(result.current.next?.slug).toBe('toy-adaptation-101')
  })

  it('re-reads storage on focus and picks up a slug persisted by another instance', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(result.current.count).toBe(0))

    // Stands in for a sibling instance of this hook (the article screen)
    // having called markRead and persisted independently of this instance.
    mockGetItem.mockResolvedValue(JSON.stringify(['toy-adaptation-101']))
    act(() => {
      latestFocusEffect?.()
    })

    await waitFor(() => expect(result.current.count).toBe(1))
    expect(result.current.read.has('toy-adaptation-101')).toBe(true)
    expect(result.current.next?.slug).toBe('switch-types')
  })

  it('a focus reload merges instead of replacing, so a pending-persist markRead survives it', async () => {
    // Storage already has one slug from before this test's markRead call.
    mockGetItem.mockResolvedValueOnce(JSON.stringify(['toy-adaptation-101']))
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(result.current.count).toBe(1))

    // markRead's setItem is fire-and-forget — leave it pending so the
    // persist genuinely has not landed by the time the focus reload below runs.
    mockSetItem.mockReturnValue(new Promise<void>(() => {}))
    act(() => {
      result.current.markRead('switch-types')
    })
    expect(result.current.read.has('switch-types')).toBe(true)

    // Control the reload's getItem explicitly rather than a pre-resolved
    // mock: count is already 2 synchronously from the markRead above, so a
    // waitFor keyed on count (or on getItem's call count) would pass before
    // the reload's own promise ever resolves, proving nothing. Resolving it
    // ourselves and flushing microtasks inside act() lets the assertions
    // below run strictly after the reload's setRead has actually landed.
    let resolveGetItem: ((value: string) => void) | undefined
    mockGetItem.mockReturnValueOnce(new Promise<string>((resolve) => { resolveGetItem = resolve }))
    act(() => {
      latestFocusEffect?.()
    })
    // Resolves with the OLD (pre-markRead) array — exactly what the reload
    // would see racing ahead of the still-pending setItem above. A replace
    // would drop 'switch-types' back out here; a merge must not.
    await act(async () => {
      resolveGetItem?.(JSON.stringify(['toy-adaptation-101']))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.read.has('switch-types')).toBe(true)
    expect(result.current.read.has('toy-adaptation-101')).toBe(true)
    expect(result.current.count).toBe(2)
  })

  it('markRead persists and updates state', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => { result.current.markRead('toy-adaptation-101') })
    await waitFor(() => expect(result.current.read.has('toy-adaptation-101')).toBe(true))
    expect(mockSetItem).toHaveBeenCalledWith(LEARN_PROGRESS_KEY, JSON.stringify(['toy-adaptation-101']))
    expect(result.current.count).toBe(1)
    expect(result.current.next?.slug).toBe('switch-types')
  })

  it('markRead is idempotent', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => { result.current.markRead('toy-adaptation-101') })
    await waitFor(() => expect(result.current.count).toBe(1))
    mockSetItem.mockClear()
    act(() => { result.current.markRead('toy-adaptation-101') })
    expect(result.current.count).toBe(1)
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it('two markRead calls for different slugs in one tick both stick', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => {
      result.current.markRead('toy-adaptation-101')
      result.current.markRead('switch-types')
    })
    expect(result.current.read.has('toy-adaptation-101')).toBe(true)
    expect(result.current.read.has('switch-types')).toBe(true)
    expect(result.current.count).toBe(2)
    expect(mockSetItem).toHaveBeenCalledWith(
      LEARN_PROGRESS_KEY,
      JSON.stringify(['toy-adaptation-101', 'switch-types']),
    )
  })

  it('next advances through order and is null once all six are read', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(LEARN_ARTICLES.slice(0, 5).map((a) => a.slug)))
    const { result } = renderHook(() => useLearnProgress())
    await waitFor(() => expect(result.current.count).toBe(5))
    expect(result.current.next?.slug).toBe(LEARN_ARTICLES[5].slug)
    act(() => { result.current.markRead(LEARN_ARTICLES[5].slug) })
    await waitFor(() => expect(result.current.count).toBe(6))
    expect(result.current.next).toBeNull()
  })
})

describe('LEARN_ARTICLES content sanity', () => {
  it('has exactly six entries with unique slugs in the specified order', () => {
    expect(LEARN_ARTICLES).toHaveLength(6)
    expect(LEARN_ARTICLES.map((a) => a.slug)).toEqual([
      'toy-adaptation-101',
      'switch-types',
      'choosing-a-toy',
      'tools-and-materials',
      'safety-and-cleaning',
      'printing-basics',
    ])
    expect(new Set(LEARN_ARTICLES.map((a) => a.slug)).size).toBe(6)
  })

  it('every article has at least one section, every section at least one paragraph, minutes >= 3', () => {
    for (const article of LEARN_ARTICLES) {
      expect(article.sections.length).toBeGreaterThanOrEqual(1)
      expect(article.minutes).toBeGreaterThanOrEqual(3)
      for (const section of article.sections) {
        expect(section.paragraphs.length).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
