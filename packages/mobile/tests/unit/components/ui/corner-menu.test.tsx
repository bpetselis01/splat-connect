import { StyleSheet } from 'react-native'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'
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

it('is closed until the trigger is pressed, then navigates from an item and closes', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  expect(screen.queryByLabelText('Add a guide')).toBeNull()
  fireEvent.press(screen.getByLabelText('Guide actions'))
  fireEvent.press(screen.getByLabelText('Add a guide'))
  expect(mockPush).toHaveBeenCalledWith('/guides/new')
  expect(screen.queryByLabelText('My guides')).toBeNull()
})

it('closes on the scrim without navigating', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  fireEvent.press(screen.getByLabelText('Guide actions'))
  // The open menu is accessibilityViewIsModal, so the scrim behind it is
  // hidden from accessibility — opt back in to reach it, as the popover
  // test does for its own scrim.
  fireEvent.press(screen.getByTestId('corner-menu-scrim', { includeHiddenElements: true }))
  expect(screen.queryByLabelText('Add a guide')).toBeNull()
  expect(mockPush).not.toHaveBeenCalled()
})

it('tells a screen reader whether it is open, since the glyph only cross-fades', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  const trigger = screen.getByLabelText('Guide actions')
  expect(trigger.props.accessibilityState.expanded).toBe(false)
  fireEvent.press(trigger)
  // Open, the menu is accessibilityViewIsModal and hides the trigger behind it
  // from accessibility queries — opt back in, as the scrim test does.
  const opened = screen.getByLabelText('Guide actions', { includeHiddenElements: true })
  expect(opened.props.accessibilityState.expanded).toBe(true)
})

it('sits above the floating tab bar, not behind it', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  const zone = StyleSheet.flatten(screen.getByTestId('corner-menu-zone').props.style) as { bottom?: number }
  expect(zone.bottom).toBe(tabBarClearance(0))
})

it('labels the trigger Actions, and Close while open', () => {
  render(<CornerMenu label="Guide actions" items={items} />)
  expect(screen.getByText('Actions')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Guide actions'))
  expect(screen.getByText('Close', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.queryByText('Actions', { includeHiddenElements: true })).toBeNull()
})
