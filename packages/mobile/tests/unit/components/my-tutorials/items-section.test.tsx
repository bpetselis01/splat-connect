import { render, screen, fireEvent } from '@testing-library/react-native'
import { ItemsSection } from '../../../../components/my-tutorials/sections/items-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockDraft = {
  tutorial: {} as Record<string, unknown>,
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
  mockDraft.tutorial = {
    id: 't1',
    status: 'draft',
    parts: [{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }],
    tools: [],
    stl_files: [],
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    safety_declared_at: null,
    tutorial_pdf_url: null,
    toy_photo_url: null,
  }
})

it('seeds its rows from the tutorial', () => {
  render(<ItemsSection noun="parts" />)
  expect(screen.getByLabelText('Part 1 name').props.value).toBe('Switch')
})

it('saves a renamed row through the replace-set', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.changeText(screen.getByLabelText('Part 1 name'), 'Micro switch')
  expect(mockDraft.replaceItems).toHaveBeenCalledWith('parts', [
    { name: 'Micro switch', quantity: 2, is_optional: false, buy_links: [] },
  ])
})

it('adds and removes rows', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.getByLabelText('Part 2 name')).toBeTruthy()

  fireEvent.press(screen.getByTestId('item-remove-0'))
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: '', quantity: 1, is_optional: false, buy_links: [] },
  ])
})

it('steps a part quantity but never below one', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('item-qty-up-0'))
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: 'Switch', quantity: 3, is_optional: false, buy_links: [] },
  ])

  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  const last = mockDraft.replaceItems.mock.calls.at(-1)?.[1] as { quantity: number }[]
  expect(last[0].quantity).toBe(1)
})

it('toggles optional', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('item-optional-0'))
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: 'Switch', quantity: 2, is_optional: true, buy_links: [] },
  ])
})

// Tools have no quantity: the column is not in the table and the stepper would
// write a field the POST does not carry.
it('gives tools no quantity stepper', () => {
  render(<ItemsSection noun="tools" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.queryByTestId('item-qty-up-0')).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Tool 1 name'), 'Screwdriver')
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('tools', [
    { name: 'Screwdriver', quantity: undefined, is_optional: false, buy_links: [] },
  ])
})

it('flags a row that cannot be saved yet rather than silently dropping it', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.getByText('Add a name to save this row')).toBeTruthy()
})

it('offers an empty state when there is nothing yet', () => {
  render(<ItemsSection noun="tools" />)
  expect(screen.getByText('No tools yet.')).toBeTruthy()
})
