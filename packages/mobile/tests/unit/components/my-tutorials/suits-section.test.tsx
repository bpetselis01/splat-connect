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

it('renders the help line and the guide questions', () => {
  render(<SuitsSection />)
  expect(screen.getByText(/None of this is required/)).toBeTruthy()
  expect(screen.getByText('What is it?')).toBeTruthy()
  expect(screen.getByText('Switch interface')).toBeTruthy()
  expect(screen.getByText('How a child uses it')).toBeTruthy()
  expect(screen.getByText('One hand is enough')).toBeTruthy()
})

it('saves a toggled chip, then null when it is emptied again', () => {
  render(<SuitsSection />)
  fireEvent.press(screen.getByText('Switch interface'))
  expect(mockDraft.save).toHaveBeenLastCalledWith({
    device_types: ['switch_interface'], helps_with: null, access: null, one_hand: false, press_force: null, play: null,
  })
  fireEvent.press(screen.getByText('Switch interface'))
  expect(mockDraft.save).toHaveBeenLastCalledWith({
    device_types: null, helps_with: null, access: null, one_hand: false, press_force: null, play: null,
  })
})

it('saves the one-hand flag as a boolean', () => {
  render(<SuitsSection />)
  fireEvent.press(screen.getByText('One hand is enough'))
  expect(mockDraft.save).toHaveBeenLastCalledWith(expect.objectContaining({ one_hand: true }))
})

it('starts from what is stored and shows the API sentence when a save is refused', () => {
  mockDraft.tutorial = { ...base, device_types: ['switch'], one_hand: true }
  mockDraft.saveError = 'press_force must be a list of: very_light, light, moderate, full.'
  render(<SuitsSection />)
  expect(screen.getByText('press_force must be a list of: very_light, light, moderate, full.')).toBeTruthy()
  fireEvent.press(screen.getByText('Lights'))
  expect(mockDraft.save).toHaveBeenLastCalledWith(expect.objectContaining({ device_types: ['switch'], one_hand: true, play: ['light'] }))
})
