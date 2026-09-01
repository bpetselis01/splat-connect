// packages/mobile/tests/unit/components/explore/article-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ArticleScreen } from '../../../../components/explore/article-screen'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}))

const mockMarkRead = jest.fn()
const mockUseLearnProgress = jest.fn()
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => mockUseLearnProgress() }))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ArticleScreen', () => {
  it("renders every section's heading and paragraphs", () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: mockMarkRead, next: null, count: 0 })
    const article = LEARN_ARTICLES.find((a) => a.slug === 'toy-adaptation-101')!
    render(<ArticleScreen slug="toy-adaptation-101" />)

    for (const section of article.sections) {
      expect(screen.getByText(section.heading)).toBeTruthy()
      for (const paragraph of section.paragraphs) {
        expect(screen.getByText(paragraph)).toBeTruthy()
      }
    }
  })

  it('marks the article read and goes back on Mark as read', () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: mockMarkRead, next: null, count: 0 })
    render(<ArticleScreen slug="toy-adaptation-101" />)

    fireEvent.press(screen.getByLabelText('Mark as read'))
    expect(mockMarkRead).toHaveBeenCalledWith('toy-adaptation-101')
    expect(mockBack).toHaveBeenCalled()
  })

  it('shows a quiet read state instead of the button when already read', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(['toy-adaptation-101']),
      markRead: mockMarkRead,
      next: null,
      count: 1,
    })
    render(<ArticleScreen slug="toy-adaptation-101" />)

    expect(screen.getByText('✓ Read')).toBeTruthy()
    expect(screen.queryByLabelText('Mark as read')).toBeNull()
  })

  it("shows the house EmptyState for an unknown slug", () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: mockMarkRead, next: null, count: 0 })
    render(<ArticleScreen slug="does-not-exist" />)

    expect(screen.getByText("We couldn't find that article.")).toBeTruthy()
  })
})
