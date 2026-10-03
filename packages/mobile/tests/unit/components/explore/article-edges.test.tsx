import { render, screen, fireEvent } from '@testing-library/react-native'
import { ArticleScreen } from '../../../../components/explore/article-screen'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: mockReplace }), Stack: { Screen: () => null } }))
const mockMarkRead = jest.fn()
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => ({ read: new Set(), markRead: mockMarkRead, next: null, count: 0 }) }))

beforeEach(() => jest.clearAllMocks())

describe('moving through the course', () => {
  it.each(LEARN_ARTICLES.map((a, i) => [a.slug, LEARN_ARTICLES[i + 1]?.slug ?? null] as const))('finishing %s marks it read and goes to %s', (slug, next) => {
    render(<ArticleScreen slug={slug} />)
    fireEvent.press(screen.getByRole('button', { name: next ? /^Next: / : 'Back to Learn' }))
    expect(mockMarkRead).toHaveBeenCalledWith(slug)
    if (next) expect(mockReplace).toHaveBeenCalledWith(`/explore/learn/${next}`)
    else expect(mockBack).toHaveBeenCalled()
  })

  it('does not mark an article read just by opening it', () => {
    render(<ArticleScreen slug={LEARN_ARTICLES[0].slug} />)
    expect(mockMarkRead).not.toHaveBeenCalled()
  })
})

describe('slugs that are not an article', () => {
  it.each(['', 'nope', 'Toy-Adaptation-101', ' toy-adaptation-101', 'constructor', '__proto__', 'toy-adaptation-101/extra', '🧸'])('shows the not-found state for %p and never marks anything read', (slug) => {
    render(<ArticleScreen slug={slug} />)
    expect(screen.getByText("We couldn't find that article.")).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(mockMarkRead).not.toHaveBeenCalled()
  })
})

describe('article content the reader draws', () => {
  it.each(LEARN_ARTICLES.map((a) => [a.slug, a] as const))('%s has distinct section headings, so no two sections collide', (_slug, article) => {
    const headings = article.sections.map((s) => s.heading)
    expect(new Set(headings).size).toBe(headings.length)
    for (const s of article.sections) {
      expect(s.heading.trim()).not.toBe('')
      for (const p of s.paragraphs) expect(p.trim()).not.toBe('')
      if (s.callout !== undefined) expect(s.callout.trim()).not.toBe('')
    }
  })

  it('draws one callout per section that has one, and none otherwise', () => {
    for (const article of LEARN_ARTICLES) {
      const view = render(<ArticleScreen slug={article.slug} />)
      expect(screen.queryAllByTestId('article-callout')).toHaveLength(article.sections.filter((s) => s.callout).length)
      view.unmount()
    }
  })

  it('numbers each article by its place in the list', () => {
    LEARN_ARTICLES.forEach((a, i) => {
      const view = render(<ArticleScreen slug={a.slug} />)
      expect(screen.getByText(`Learn · ${i + 1} of ${LEARN_ARTICLES.length}`)).toBeTruthy()
      view.unmount()
    })
  })
})
