import { render, screen, fireEvent } from '@testing-library/react-native'
import { SAFETY_CHECKLIST } from '@splat-connect/types'
import { SafetySection } from '../../../../components/my-tutorials/sections/safety-section'

const mockConfirm = jest.fn()
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: (...a: unknown[]) => mockConfirm(...a) }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockDraft = {
  tutorial: { id: 't1', safety_declared_at: null, status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, parts: [], tools: [], stl_files: [], } as Record<string, unknown>,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null as string | null,
  save: jest.fn(),
  saveNow: jest.fn(),
  replaceItems: jest.fn(),
  replaceSafetyNotes: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

beforeEach(() => {
  jest.clearAllMocks()
  mockDraft.tutorial = { id: 't1', safety_declared_at: null, status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, parts: [], tools: [], stl_files: [], }
})

it('lists every checklist point', () => {
  render(<SafetySection />)
  for (const item of SAFETY_CHECKLIST) {
    expect(screen.getByText(new RegExp(item.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
  }
})

// The client only ever affirms; the server stamps the timestamp.
it('affirms rather than sets a date', () => {
  render(<SafetySection />)
  fireEvent.press(screen.getByTestId('safety-declare'))
  // Nothing is saved until the person confirms the warning.
  expect(mockDraft.save).not.toHaveBeenCalled()
  expect(mockConfirm).toHaveBeenCalledWith(expect.stringMatching(/declare/i), expect.stringMatching(/untick/), 'Declare', expect.any(Function))
  mockConfirm.mock.calls[0][3]()
  expect(mockDraft.save).toHaveBeenCalledWith({ safety_declared: true })
})

it('saves nothing when the warning is cancelled', () => {
  render(<SafetySection />)
  fireEvent.press(screen.getByTestId('safety-declare'))
  expect(mockDraft.save).not.toHaveBeenCalled()
})

it('shows the declaration once made and offers no way to unmake it', () => {
  mockDraft.tutorial = {
    id: 't1',
    safety_declared_at: '2026-09-02T00:00:00Z',
    build_minutes: 30,
    status: 'draft',
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    parts: [],
    tools: [],
    stl_files: [],
  }
  render(<SafetySection />)
  expect(screen.getByText(/Declared on/)).toBeTruthy()
  expect(screen.queryByTestId('safety-declare')).toBeNull()
})

it('T12 adds a safety note and saves the list', () => {
  render(<SafetySection />)
  fireEvent.press(screen.getByText('+ Add a safety note'))
  fireEvent.changeText(screen.getByLabelText('Safety note 1 title'), 'Battery door must be screwed shut')
  expect(mockDraft.replaceSafetyNotes).toHaveBeenLastCalledWith([{ title: 'Battery door must be screwed shut', detail: null }])
})

// Opened cold, the editor must not seed from a draft that has not arrived.
it('shows the saved notes when the draft loads after the screen opens', () => {
  ;(mockDraft as { tutorial: unknown }).tutorial = null
  mockDraft.loading = true
  const { rerender } = render(<SafetySection />)
  expect(screen.queryByLabelText('Safety note 1 title')).toBeNull()
  mockDraft.loading = false
  mockDraft.tutorial = { id: 't1', safety_declared_at: null, status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, parts: [], tools: [], stl_files: [], safety_notes: [{ id: 'n', tutorial_id: 't1', position: 1, title: 'Battery door must be screwed shut', detail: null }] }
  rerender(<SafetySection />)
  expect(screen.getByDisplayValue('Battery door must be screwed shut')).toBeTruthy()
})
