import { render, screen, fireEvent } from '@testing-library/react-native'
import { DetailsSection } from '../../../../components/my-tutorials/sections/details-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const base = () => ({
  id: 't1', title: 'Roaring dinosaur', description: null, kind: 'toy_adaptation', difficulty: 'easy', status: 'draft',
  safety_declared_at: null, build_minutes: 30, tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [],
  age_min: null, age_max: null,
}) as Record<string, unknown>
const mockDraft = {
  tutorial: base(), loading: false, loadError: false, saveState: 'idle', saveError: null as string | null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(), flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

beforeEach(() => { jest.clearAllMocks(); mockDraft.tutorial = base(); mockDraft.saveError = null })
const lastSave = () => mockDraft.save.mock.lastCall![0]

describe('title and description', () => {
  it('saves an empty title as typed so the checklist can flag it', () => {
    render(<DetailsSection />)
    fireEvent.changeText(screen.getByLabelText('Title'), '')
    expect(lastSave()).toEqual({ title: '' })
  })

  it('passes emoji, quotes, markup, RTL and a 500-character title through untouched', () => {
    render(<DetailsSection />)
    for (const t of ['🧸🦄 Dino', `"Roar" <b>&</b> 'x'`, 'سارة', 'N'.repeat(500)]) {
      fireEvent.changeText(screen.getByLabelText('Title'), t)
      expect(lastSave()).toEqual({ title: t })
    }
  })

  it('keeps newlines and inner spacing in a description, nulling only the blank one', () => {
    render(<DetailsSection />)
    fireEvent.changeText(screen.getByLabelText('Description'), 'Line one\n\n  Line two ')
    expect(lastSave()).toEqual({ description: 'Line one\n\n  Line two ' })
    fireEvent.changeText(screen.getByLabelText('Description'), '\n\t ')
    expect(lastSave()).toEqual({ description: null })
  })

  it('shows an existing description in its field', () => {
    mockDraft.tutorial = { ...base(), description: 'Why it matters' }
    render(<DetailsSection />)
    expect(screen.getByLabelText('Description').props.value).toBe('Why it matters')
  })
})

describe('age range', () => {
  it('saves a number, and null when the field is emptied', () => {
    render(<DetailsSection />)
    fireEvent.changeText(screen.getByLabelText('Youngest age'), '3')
    expect(lastSave()).toEqual({ age_min: 3 })
    fireEvent.changeText(screen.getByLabelText('Oldest age'), '')
    expect(lastSave()).toEqual({ age_max: null })
  })

  it('shows 0 as an age rather than an empty field', () => {
    mockDraft.tutorial = { ...base(), age_min: 0, age_max: 18 }
    render(<DetailsSection />)
    expect(screen.getByLabelText('Youngest age').props.value).toBe('0')
    expect(screen.getByLabelText('Oldest age').props.value).toBe('18')
  })

  it.each(['abc', '-', '  ', '.'])('never saves NaN or a made-up zero for %p', (text) => {
    render(<DetailsSection />)
    fireEvent.changeText(screen.getByLabelText('Youngest age'), text)
    const v = lastSave().age_min
    expect(Number.isNaN(v)).toBe(false)
    expect(v === null || v === undefined).toBe(true)
  })

  it('saves only a whole number for a pasted decimal', () => {
    render(<DetailsSection />)
    fireEvent.changeText(screen.getByLabelText('Youngest age'), '4.5')
    expect(Number.isInteger(lastSave().age_min)).toBe(true)
  })
})

describe('chips', () => {
  it('saves each build time, naming the longest "4 h or more"', () => {
    render(<DetailsSection />)
    fireEvent.press(screen.getByText('4 h or more'))
    expect(lastSave()).toEqual({ build_minutes: 240 })
  })

  it('does not un-pick difficulty when the chosen chip is pressed again', () => {
    render(<DetailsSection />)
    fireEvent.press(screen.getByText('Easy'))
    expect(lastSave()).toEqual({ difficulty: 'easy' })
  })

  it('no longer asks what the switch asks', () => {
    render(<DetailsSection />)
    expect(screen.queryByText('What the switch asks')).toBeNull()
  })

  it('opens Backing for this guide', () => {
    render(<DetailsSection />)
    fireEvent.press(screen.getByText('Backing'))
    expect(mockPush).toHaveBeenCalledWith('/tutorials/t1/backing')
  })

  it('renders nothing while the draft has not arrived', () => {
    mockDraft.tutorial = null as never
    const { toJSON } = render(<DetailsSection />)
    expect(toJSON()).toBeNull()
  })
})
