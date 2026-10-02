// packages/mobile/tests/unit/components/explore/learn-hub.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { LearnHub, learnSections } from '../../../../components/explore/learn-hub'
import { LEARN_ARTICLES } from '../../../../lib/learn-content'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockUseLearnProgress = jest.fn()
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => mockUseLearnProgress() }))

// An integration test that exercised the REAL hook here (render the hub,
// mutate storage behind its back, fire a refocus, assert the tick/Continue
// card move) was tried and dropped: every test in this file shares the
// static jest.mock('../../../../lib/learn', ...) above, hoisted file-wide,
// so un-mocking it for one test needs jest.resetModules() + jest.doMock()
// + a dynamic require() of LearnHub inside that one test. No test anywhere
// in this suite uses that pattern — every other file's fix-verification
// lives at the hook level, same as this file's sibling
// tests/unit/lib/learn.test.ts, which now covers the real refocus wiring
// directly. Risk this leaves open: nothing here proves LearnHub itself is
// wired to the real (non-mocked) useLearnProgress export at all — only that
// the hook behaves correctly in isolation, and that the mocked hub renders
// correctly for whatever shape the hook returns.

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockRejectedValue(new Error('offline'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
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

  it('numbers the first three under Start here and lists the rest, unnumbered, under Going deeper', () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: jest.fn(), next: LEARN_ARTICLES[0], count: 0 })
    const { start, deeper } = learnSections(LEARN_ARTICLES)
    expect(start.map((a) => a.slug)).toEqual(['toy-adaptation-101', 'switch-types', 'choosing-a-toy'])
    expect(deeper.map((a) => a.slug)).toEqual(['tools-and-materials', 'safety-and-cleaning', 'printing-basics'])

    render(<LearnHub />)
    expect(screen.getByText('Start here')).toBeTruthy()
    expect(screen.getByText('Going deeper')).toBeTruthy()
    expect(screen.getByRole('button', { name: '1. Toy adaptation 101' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tools and materials' })).toBeTruthy()
    expect(screen.getByTestId('learn-node-icon-tools-and-materials', { includeHiddenElements: true })).toBeTruthy()
  })

  // Decided 2026-09-30 (learn-ask-an-expert-mobile): the app reaches guides,
  // Learn, Submit an idea and organisations directly; the row only sent people
  // to a web page.
  it('has no Ask an expert row', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[0],
      count: 0,
    })
    render(<LearnHub />)
    expect(screen.queryByText('Ask an expert')).toBeNull()
  })

  // site-content-learn-legal-editing: the app reads the course's title, outcome and "Shown as".
  it("shows a saved course title and outcome in place of the app's intro", async () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: jest.fn(), next: LEARN_ARTICLES[0], count: 0 })
    mockGet.mockResolvedValue({ title: 'Toy adaptation, start to finish', outcome: 'Adapt a battery toy for a switch.', shown_as: 'free', units: [] })
    render(<LearnHub />)
    expect(await screen.findByText('Toy adaptation, start to finish')).toBeTruthy()
    expect(screen.getByText('Adapt a battery toy for a switch.')).toBeTruthy()
    expect(screen.queryByText(/How switch adaptation works/)).toBeNull()
  })

  it('says "Course hidden" and lists nothing when an admin hid the course', async () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: jest.fn(), next: LEARN_ARTICLES[0], count: 0 })
    mockGet.mockResolvedValue({ title: null, outcome: null, shown_as: 'hidden', units: [] })
    render(<LearnHub />)
    expect(await screen.findByText('Course hidden')).toBeTruthy()
    expect(screen.queryByText('Start here')).toBeNull()
  })
})
