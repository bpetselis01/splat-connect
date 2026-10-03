import { render, screen, fireEvent } from '@testing-library/react-native'
import { SafetySection } from '../../../../components/my-tutorials/sections/safety-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockDraft = {
  tutorial: {} as Record<string, unknown>, loading: false, loadError: false, saveState: 'idle', saveError: null as string | null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(), replaceSafetyNotes: jest.fn(), flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const open = (over: object = {}) => {
  mockDraft.tutorial = { id: 't1', safety_declared_at: null, safety_notes: [], status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [], ...over }
}
const sent = () => mockDraft.replaceSafetyNotes.mock.lastCall![0] as { title: string; detail: string | null }[]

beforeEach(() => { jest.clearAllMocks(); mockDraft.saveError = null; open() })

describe('the declaration', () => {
  it('sends only the affirmation, never a date, when ticked', () => {
    render(<SafetySection />)
    fireEvent.press(screen.getByTestId('safety-declare'))
    expect(mockDraft.save).toHaveBeenCalledWith({ safety_declared: true })
  })

  it('offers no tick once declared, and prints the date', () => {
    open({ safety_declared_at: '2026-09-02T00:00:00Z' })
    render(<SafetySection />)
    expect(screen.queryByTestId('safety-declare')).toBeNull()
    expect(screen.getByText(/Declared on/)).toBeTruthy()
  })
})

describe('safety notes', () => {
  it('adds an empty note that is not yet worth sending', () => {
    render(<SafetySection />)
    fireEvent.press(screen.getByText('+ Add a safety note'))
    expect(sent()).toEqual([{ title: '', detail: null }])
  })

  it('turns an emptied detail into null and caps title and detail lengths', () => {
    open({ safety_notes: [{ title: 'Hot', detail: 'Wait' }] })
    render(<SafetySection />)
    expect(screen.getByLabelText('Safety note 1 title').props.maxLength).toBe(80)
    expect(screen.getByLabelText('Safety note 1 detail').props.maxLength).toBe(500)
    fireEvent.changeText(screen.getByLabelText('Safety note 1 detail'), '')
    expect(sent()).toEqual([{ title: 'Hot', detail: null }])
  })

  it('keeps emoji, quotes and markup in a note', () => {
    open({ safety_notes: [{ title: 'x', detail: null }] })
    render(<SafetySection />)
    fireEvent.changeText(screen.getByLabelText('Safety note 1 title'), '⚠️ "Sharp" <edge> & hot')
    expect(sent()[0].title).toBe('⚠️ "Sharp" <edge> & hot')
  })

  it('removes the chosen note only', () => {
    open({ safety_notes: [{ title: 'a', detail: null }, { title: 'b', detail: null }, { title: 'c', detail: null }] })
    render(<SafetySection />)
    fireEvent.press(screen.getAllByText('Remove')[1])
    expect(sent().map((n) => n.title)).toEqual(['a', 'c'])
  })

  it('removing the last note sends an empty list', () => {
    open({ safety_notes: [{ title: 'a', detail: null }] })
    render(<SafetySection />)
    fireEvent.press(screen.getByText('Remove'))
    expect(sent()).toEqual([])
  })

  it('stops offering Add at 20 notes and offers it at 19', () => {
    open({ safety_notes: Array.from({ length: 19 }, (_, i) => ({ title: `n${i}`, detail: null })) })
    render(<SafetySection />)
    fireEvent.press(screen.getByText('+ Add a safety note'))
    expect(screen.queryByText('+ Add a safety note')).toBeNull()
    expect(sent()).toHaveLength(20)
  })

  it('shows the draft’s save error', () => {
    mockDraft.saveError = 'Could not save. Your changes are still here - try again.'
    render(<SafetySection />)
    expect(screen.getByText(mockDraft.saveError)).toBeTruthy()
  })
})
