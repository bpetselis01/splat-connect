import { render, screen, fireEvent } from '@testing-library/react-native'
import { DetailsSection } from '../../../../components/my-tutorials/sections/details-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// ErrorRow comes from components/auth-screen, which imports useAuth from
// lib/auth-context — and that module reaches the live supabase client. Mocking
// it here (unused by this section) is what keeps that import inert.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockDraft = {
  tutorial: {
    id: 't1',
    title: 'Roaring dinosaur',
    description: null,
    kind: 'toy_adaptation',
    difficulty: 'easy',
    maturity: 'complete',
    status: 'draft',
    updated_at: 'v1',
    safety_declared_at: null,
  } as Record<string, unknown>,
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
  mockDraft.saveState = 'idle'
  mockDraft.saveError = null
})

it('saves the title as it is typed', () => {
  render(<DetailsSection />)
  fireEvent.changeText(screen.getByLabelText('Title'), 'Roaring T-rex')
  expect(mockDraft.save).toHaveBeenCalledWith({ title: 'Roaring T-rex' })
})

it('saves a blank description as null, not an empty string', () => {
  render(<DetailsSection />)
  fireEvent.changeText(screen.getByLabelText('Description'), '   ')
  expect(mockDraft.save).toHaveBeenCalledWith({ description: null })
})

it('saves a chip choice', () => {
  render(<DetailsSection />)
  fireEvent.press(screen.getByText('Medium'))
  expect(mockDraft.save).toHaveBeenCalledWith({ difficulty: 'medium' })
  fireEvent.press(screen.getByText('Assistive tech'))
  expect(mockDraft.save).toHaveBeenCalledWith({ kind: 'assistive_tech' })
})

it('shows the save state', () => {
  mockDraft.saveState = 'saving'
  render(<DetailsSection />)
  expect(screen.getByText('Saving...')).toBeTruthy()
})

it('shows a save failure without losing the edit', () => {
  mockDraft.saveState = 'error'
  mockDraft.saveError = 'Could not save. Your changes are still here - try again.'
  render(<DetailsSection />)
  expect(
    screen.getByText('Could not save. Your changes are still here - try again.')
  ).toBeTruthy()
  expect(screen.getByLabelText('Title').props.value).toBe('Roaring dinosaur')
})
