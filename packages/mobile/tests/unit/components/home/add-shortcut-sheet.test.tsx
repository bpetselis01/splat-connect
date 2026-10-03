import { StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AddShortcutSheet } from '../../../../components/home/add-shortcut-sheet'
import type { Feature } from '../../../../lib/home-shortcuts'
import { theme } from '../../../../lib/theme'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const F = (id: string, name: string, group: Feature['group'], tint: Feature['tint'] = 'sky'): Feature => ({
  id, name, icon: 'book-outline', tint, group, href: `/${id}` as Feature['href'],
})
// Deliberately out of group order: the sheet orders the groups, not the catalogue.
const mockFeatures = [
  F('p', 'Request a print', 'Printing', 'mint'),
  F('g', 'Guides', 'Learn and build', 'honey'),
  F('t', 'Toy library', 'Toys', 'apr'),
  F('a', 'Account', 'Me', 'vio'),
  F('e', 'Events', 'Community', 'sun'),
]
const mockHome = { ids: ['g', 'e'], add: jest.fn(), remove: jest.fn() }
jest.mock('../../../../lib/home-shortcuts', () => ({
  get FEATURES() { return mockFeatures },
  useHomeShortcuts: () => ({ ids: mockHome.ids, features: [], ready: true, add: mockHome.add, remove: mockHome.remove }),
}))

const open = (onClose = jest.fn()) => {
  render(<AddShortcutSheet visible onClose={onClose} />)
  return onClose
}
beforeEach(() => jest.clearAllMocks())

it('renders nothing when not visible', () => {
  render(<AddShortcutSheet visible={false} onClose={jest.fn()} />)
  expect(screen.queryByText('Add a shortcut')).toBeNull()
})

it('shows the title and how many are on Home', () => {
  open()
  expect(screen.getByText('Add a shortcut')).toBeTruthy()
  expect(screen.getByText('2 on Home')).toBeTruthy()
})

it('groups features in the board order under uppercase headings', () => {
  open()
  const heads = screen.getAllByTestId('sheet-group').map((n) => n.props.children)
  expect(heads).toEqual(['Learn and build', 'Toys', 'Printing', 'Community', 'Me'])
  expect(StyleSheet.flatten(screen.getAllByTestId('sheet-group')[0].props.style)).toMatchObject({
    fontSize: 12, textTransform: 'uppercase', color: theme.colors.muted,
  })
})

it('a row not on Home reads Add and adds on press; one on Home reads Remove and removes', () => {
  open()
  const add = screen.getByLabelText('Add Toy library to Home')
  expect(add.props.accessibilityState.selected).toBe(false)
  fireEvent.press(add)
  expect(mockHome.add).toHaveBeenCalledWith('t')
  const remove = screen.getByLabelText('Remove Guides from Home')
  expect(remove.props.accessibilityState.selected).toBe(true)
  fireEvent.press(remove)
  expect(mockHome.remove).toHaveBeenCalledWith('g')
})

it('the trailing control is a plus on accentLight, or a tick on mintSoft', () => {
  open()
  const circle = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).findByProps({ testID: 'row-control' }).props.style)
  expect(circle('Add Toy library to Home')).toMatchObject({ width: 30, height: 30, backgroundColor: theme.colors.accentLight })
  expect(circle('Remove Guides from Home')).toMatchObject({ backgroundColor: theme.colors.mintSoft })
})

it('filters by name and says so when nothing matches', () => {
  open()
  fireEvent.changeText(screen.getByPlaceholderText('Search features'), 'toy')
  expect(screen.getByText('Toy library')).toBeTruthy()
  expect(screen.queryByText('Guides')).toBeNull()
  expect(screen.queryByText('Printing')).toBeNull()
  fireEvent.changeText(screen.getByPlaceholderText('Search features'), 'zzz')
  expect(screen.getByText('No features match')).toBeTruthy()
})

it('closes from the dim, and from the hardware back request', () => {
  const onClose = open()
  fireEvent.press(screen.getByLabelText('Close'))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent(screen.getByTestId('add-sheet-modal'), 'requestClose')
  expect(onClose).toHaveBeenCalledTimes(2)
})
