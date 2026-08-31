// packages/mobile/tests/unit/components/explore/learn-hub.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { LearnHub } from '../../../../components/explore/learn-hub'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockUseLearnProgress = jest.fn()
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => mockUseLearnProgress() }))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('LearnHub', () => {
  it('names the first unread article and its position in the Continue card', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(['toy-adaptation-101']),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[1],
      count: 1,
    })
    render(<LearnHub />)
    expect(screen.getByText('2 · Switch types explained')).toBeTruthy()
    expect(screen.getByText('1 of 6 read · 3 min left on this one ›')).toBeTruthy()
  })

  it('shows a tick on every read node and a numeral on the rest', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(['toy-adaptation-101', 'switch-types']),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[2],
      count: 2,
    })
    render(<LearnHub />)
    expect(
      screen.getByTestId('learn-node-check-toy-adaptation-101', { includeHiddenElements: true })
    ).toBeTruthy()
    expect(screen.getByTestId('learn-node-check-switch-types', { includeHiddenElements: true })).toBeTruthy()
    expect(
      screen.getByTestId('learn-node-numeral-choosing-a-toy', { includeHiddenElements: true })
    ).toBeTruthy()
  })

  it('routes to the tapped node’s article', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[0],
      count: 0,
    })
    render(<LearnHub />)
    fireEvent.press(screen.getByRole('button', { name: '3. Choosing a toy to adapt' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/learn/choosing-a-toy')
  })

  it('replaces the Continue card with a quiet all-read line once every article is read', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(LEARN_ARTICLES.map((a) => a.slug)),
      markRead: jest.fn(),
      next: null,
      count: 6,
    })
    render(<LearnHub />)
    expect(screen.queryByText(/CONTINUE/)).toBeNull()
    expect(screen.getByText('All six read.')).toBeTruthy()
  })

  it('opens the web Ask an expert page', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[0],
      count: 0,
    })
    const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true))
    render(<LearnHub />)
    fireEvent.press(screen.getByRole('link', { name: 'Ask an expert' }))
    expect(openURL).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_WEB_URL}/learn/ask-an-expert`)
  })
})
