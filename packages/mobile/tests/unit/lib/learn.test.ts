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

beforeEach(() => {
  jest.clearAllMocks()
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
