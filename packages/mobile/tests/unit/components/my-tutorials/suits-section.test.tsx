import { render, screen, fireEvent } from '@testing-library/react-native'
import { SuitsSection } from '../../../../components/my-tutorials/sections/suits-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const base = { id: 't1', status: 'draft', kind: 'toy_adaptation', difficulty: 'easy', title: 'T', tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [] }
const mockDraft = {
  tutorial: { ...base } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null as string | null,
  save: jest.fn(), saveNow: jest.fn(), flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

beforeEach(() => {
  jest.clearAllMocks()
  mockDraft.saveError = null
  mockDraft.tutorial = { ...base }
})

it('renders the help line, chips and the three ranges', () => {
  render(<SuitsSection />)
  expect(screen.getByText(/None of this is required/)).toBeTruthy()
  expect(screen.getByText('Lever')).toBeTruthy()
  expect(screen.getByText('Both hands')).toBeTruthy()
  expect(screen.getByLabelText('Hand width (mm) from')).toBeTruthy()
  expect(screen.getByLabelText('Reach from seated (cm) from')).toBeTruthy()
})

it('saves a toggled chip, then null when it is emptied again', () => {
  render(<SuitsSection />)
  fireEvent.press(screen.getByText('Lever'))
  expect(mockDraft.save).toHaveBeenLastCalledWith({ movement: ['lever'], hands: null, play: null, fit: null })
  fireEvent.press(screen.getByText('Lever'))
  expect(mockDraft.save).toHaveBeenLastCalledWith({ movement: null, hands: null, play: null, fit: null })
})

it('sends fit with only the filled pairs', () => {
  render(<SuitsSection />)
  fireEvent.changeText(screen.getByLabelText('Hand width (mm) from'), '60')
  expect(mockDraft.save).not.toHaveBeenCalled()
  expect(screen.getByText(/fill in both ends/)).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Hand width (mm) to'), '80')
  expect(mockDraft.save).toHaveBeenLastCalledWith({ movement: null, hands: null, play: null, fit: { palm_width_mm: [60, 80] } })
  expect(screen.queryByText(/fill in both ends/)).toBeNull()
})

it('refuses min above max locally and does not save', () => {
  render(<SuitsSection />)
  fireEvent.changeText(screen.getByLabelText('Hand width (mm) from'), '90')
  fireEvent.changeText(screen.getByLabelText('Hand width (mm) to'), '80')
  expect(mockDraft.save).not.toHaveBeenCalled()
  expect(screen.getByText(/smallest first/)).toBeTruthy()
})

it('starts from what is stored and shows the API sentence when a save is refused', () => {
  mockDraft.tutorial = { ...base, hands: ['both'], fit: { reach_cm: [10, 20] } }
  mockDraft.saveError = 'Reach from seated (cm): a range from 5 to 90, smallest first.'
  render(<SuitsSection />)
  expect(screen.getByLabelText('Reach from seated (cm) from').props.value).toBe('10')
  expect(screen.getByText('Reach from seated (cm): a range from 5 to 90, smallest first.')).toBeTruthy()
})
