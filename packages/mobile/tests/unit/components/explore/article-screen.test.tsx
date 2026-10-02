// packages/mobile/tests/unit/components/explore/article-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ArticleScreen } from '../../../../components/explore/article-screen'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  Stack: { Screen: () => null },
}))

const mockMarkRead = jest.fn()
jest.mock('../../../../lib/learn', () => ({
  useLearnProgress: () => ({ read: new Set(), markRead: mockMarkRead, next: null, count: 0 }),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ArticleScreen', () => {
  it("renders every section's heading, paragraphs and callout, with its place in Learn", () => {
    const article = LEARN_ARTICLES.find((a) => a.slug === 'toy-adaptation-101')!
    render(<ArticleScreen slug="toy-adaptation-101" />)

    expect(screen.getByText(`Learn · 1 of ${LEARN_ARTICLES.length}`)).toBeTruthy()
    for (const section of article.sections) {
      expect(screen.getByText(section.heading)).toBeTruthy()
      for (const paragraph of section.paragraphs) {
        expect(screen.getByText(paragraph)).toBeTruthy()
      }
      if (section.callout) expect(screen.getByText(section.callout)).toBeTruthy()
    }
    expect(screen.getAllByTestId('article-callout')).toHaveLength(1)
  })

  it('has the next article as its only footer action, and reaching it marks this one read', () => {
    render(<ArticleScreen slug="toy-adaptation-101" />)

    fireEvent.press(screen.getByRole('button', { name: 'Next: Switch types explained' }))
    expect(mockMarkRead).toHaveBeenCalledWith('toy-adaptation-101')
    expect(mockReplace).toHaveBeenCalledWith('/explore/learn/switch-types')
  })

  it('goes back to Learn from the last article', () => {
    const last = LEARN_ARTICLES[LEARN_ARTICLES.length - 1]
    render(<ArticleScreen slug={last.slug} />)

    fireEvent.press(screen.getByRole('button', { name: 'Back to Learn' }))
    expect(mockMarkRead).toHaveBeenCalledWith(last.slug)
    expect(mockBack).toHaveBeenCalled()
  })

  it('shows the house EmptyState for an unknown slug', () => {
    render(<ArticleScreen slug="does-not-exist" />)

    expect(screen.getByText("We couldn't find that article.")).toBeTruthy()
  })
})
