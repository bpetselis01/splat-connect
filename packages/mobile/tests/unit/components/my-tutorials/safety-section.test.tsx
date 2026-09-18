import { render, screen, fireEvent } from '@testing-library/react-native'
import { SAFETY_CHECKLIST } from '@splat-connect/types'
import { SafetySection } from '../../../../components/my-tutorials/sections/safety-section'

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
  expect(mockDraft.save).toHaveBeenCalledWith({ safety_declared: true })
})

it('shows the declaration once made and offers no way to unmake it', () => {
  mockDraft.tutorial = {
    id: 't1',
    safety_declared_at: '2026-09-02T00:00:00Z',
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
