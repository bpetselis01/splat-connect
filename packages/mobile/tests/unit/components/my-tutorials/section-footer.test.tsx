import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SectionFooter } from '../../../../components/my-tutorials/section-footer'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockNav = { canGoBack: true }
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => mockNav.canGoBack }),
}))

const mockDraft = {
  tutorial: null as unknown,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null,
  save: jest.fn(),
  saveNow: jest.fn(),
  replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

/** A complete toy adaptation; override to open a gap. */
const tutorial = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Roaring dinosaur',
  kind: 'toy_adaptation',
  difficulty: 'easy',
  status: 'draft',
  safety_declared_at: '2026-09-02T00:00:00Z',
  tutorial_pdf_url: 't1/tutorial.pdf',
  toy_photo_url: 'https://example.test/p.jpg',
  parts: [{ id: 'p1' }],
  tools: [{ id: 'o1' }],
  stl_files: [],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockNav.canGoBack = true
})

it('points Next at the next section still missing something, not the next in the list', () => {
  // Details is complete and Safety is not — from Details, Next is Safety.
  mockDraft.tutorial = tutorial({ safety_declared_at: null })
  render(<SectionFooter section="details" />)
  expect(screen.getByText('Next: Safety')).toBeTruthy()
})

it('skips complete sections rather than walking them', () => {
  // Only Files is open. From Details, Next jumps past Safety/Parts/Tools.
  mockDraft.tutorial = tutorial({ toy_photo_url: null })
  render(<SectionFooter section="details" />)
  expect(screen.getByText('Next: Files')).toBeTruthy()
})

it('wraps past the end rather than dead-ending on the last section', () => {
  mockDraft.tutorial = tutorial({ safety_declared_at: null })
  render(<SectionFooter section="files" />)
  expect(screen.getByText('Next: Safety')).toBeTruthy()
})

it('never offers the section you are already on', () => {
  // Parts is the only gap, and Parts is where we are — so there is no next.
  mockDraft.tutorial = tutorial({ parts: [] })
  render(<SectionFooter section="parts" />)
  expect(screen.getByText('Review and submit')).toBeTruthy()
})

it('offers the hub, not a second Submit, once nothing is missing', async () => {
  mockDraft.tutorial = tutorial()
  render(<SectionFooter section="files" />)
  fireEvent.press(screen.getByTestId('section-next'))
  // Submit stays in exactly one place; this only takes you to it.
  await waitFor(() => expect(mockBack).toHaveBeenCalled())
})

it('flushes pending writes before leaving, so the hub is not behind', async () => {
  mockDraft.tutorial = tutorial({ safety_declared_at: null })
  render(<SectionFooter section="details" />)
  fireEvent.press(screen.getByTestId('section-next'))
  await waitFor(() => expect(mockDraft.flush).toHaveBeenCalled())
  expect(mockReplace).toHaveBeenCalledWith('/tutorials/t1/safety')
})

it('reaches the hub by an explicit route when nothing is behind on the stack', async () => {
  // The create path: guides/new replaced itself, so there is no history.
  mockNav.canGoBack = false
  mockDraft.tutorial = tutorial()
  render(<SectionFooter section="files" />)
  fireEvent.press(screen.getByTestId('section-back'))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tutorials/t1'))
  expect(mockBack).not.toHaveBeenCalled()
})
