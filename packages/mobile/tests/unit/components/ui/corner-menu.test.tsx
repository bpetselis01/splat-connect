import { render, screen, fireEvent } from '@testing-library/react-native'
import { CornerMenu } from '../../../../components/ui/CornerMenu'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const items = [
  { label: 'Add a guide', icon: 'add' as const, href: '/guides/new', primary: true },
  { label: 'My guides', icon: 'book-outline' as const, href: '/tutorials', count: 2 },
]

beforeEach(() => mockPush.mockClear())

it('creates in one tap: the primary action is the button, not a row inside it', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  // No trigger press first — this is the whole point of the split.
  fireEvent.press(screen.getByLabelText('Add a guide'))
  expect(mockPush).toHaveBeenCalledWith('/guides/new')
})

it('keeps the rest behind the trigger, and never repeats the primary there', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  expect(screen.queryByLabelText('My guides')).toBeNull()

  fireEvent.press(screen.getByLabelText('Guide actions'))
  expect(screen.getByLabelText('My guides')).toBeTruthy()
  // One create action on screen, not two. The open menu is
  // accessibilityViewIsModal, so the corner button behind it is hidden from
  // accessibility while it is open — opt back in to count it.
  expect(screen.getAllByLabelText('Add a guide', { includeHiddenElements: true })).toHaveLength(1)

  fireEvent.press(screen.getByLabelText('My guides'))
  expect(mockPush).toHaveBeenCalledWith('/tutorials')
  expect(screen.queryByLabelText('My guides')).toBeNull()
})

it('surfaces a hidden row’s count on the trigger', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  // A count nobody can see is a count that does not work: My guides is behind
  // the ⋯, so the ⋯ carries its 2.
  expect(screen.getByText('2')).toBeTruthy()
})

it('closes on the scrim without navigating', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  fireEvent.press(screen.getByLabelText('Guide actions'))
  // The open menu is accessibilityViewIsModal, so the scrim behind it is
  // hidden from accessibility — opt back in to reach it, as the popover
  // test does for its own scrim.
  fireEvent.press(screen.getByTestId('corner-menu-scrim', { includeHiddenElements: true }))
  expect(screen.queryByLabelText('My guides')).toBeNull()
  expect(mockPush).not.toHaveBeenCalled()
})
