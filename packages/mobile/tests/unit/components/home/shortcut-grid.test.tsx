// packages/mobile/tests/unit/components/home/shortcut-grid.test.tsx
import { StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ShortcutGrid, slotAt, slotPos, reorder } from '../../../../components/home/shortcut-grid'
import type { Feature } from '../../../../lib/home-shortcuts'
import { theme } from '../../../../lib/theme'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const F = (id: string, name: string, tint: Feature['tint'] = 'sky'): Feature => ({
  id,
  name,
  icon: 'book-outline',
  tint,
  group: 'Toys',
  href: `/${id}` as Feature['href'],
})
const features = [F('a', 'Guides', 'honey'), F('b', 'Toys', 'apr'), F('c', 'Events', 'sun')]

function setup(editing = false) {
  const h = {
    onOpen: jest.fn(),
    onAdd: jest.fn(),
    onEnterEdit: jest.fn(),
    onRemove: jest.fn(),
    onMove: jest.fn(),
    onMoveToTop: jest.fn(),
    onDragging: jest.fn(),
  }
  render(<ShortcutGrid features={features} editing={editing} {...h} />)
  // 358 = a 390 phone less the 16px gutters: columns of (358 - 3*6) / 4 = 85.
  fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 0 } } })
  return h
}

describe('grid maths', () => {
  it('lays four across at gap 6 by 18, each cell 96 tall', () => {
    expect(slotPos(0, 85)).toEqual({ x: 0, y: 0 })
    expect(slotPos(3, 85)).toEqual({ x: 3 * 91, y: 0 })
    expect(slotPos(5, 85)).toEqual({ x: 91, y: 114 })
  })
  it('reads the nearest slot, clamped to the tiles that exist', () => {
    expect(slotAt(95, 4, 85, 8)).toBe(1)
    expect(slotAt(0, 120, 85, 8)).toBe(4)
    expect(slotAt(900, 900, 85, 6)).toBe(5)
    expect(slotAt(-50, -50, 85, 6)).toBe(0)
  })
  it('moves one id to a slot, shifting the rest', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(reorder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })
})

describe('ShortcutGrid at rest', () => {
  it('draws a labelled tile per shortcut, tinted, and a dashed Add tile', () => {
    setup()
    expect(screen.getByText('Guides')).toBeTruthy()
    const glyph = StyleSheet.flatten(screen.getByTestId('glyph-a').props.style) as Record<string, unknown>
    expect(glyph).toMatchObject({ width: 62, height: 62, borderRadius: 20, backgroundColor: theme.colors.honeySoft })
    const add = StyleSheet.flatten(screen.getByTestId('glyph-add').props.style) as Record<string, unknown>
    expect(add).toMatchObject({ borderStyle: 'dashed', borderWidth: 2 })
    expect(screen.queryByTestId('remove-a')).toBeNull()
  })

  it('opens a shortcut on press and the add sheet on Add', () => {
    const h = setup()
    fireEvent.press(screen.getByLabelText('Toys'))
    expect(h.onOpen).toHaveBeenCalledWith(features[1])
    fireEvent.press(screen.getByLabelText('Add a shortcut'))
    expect(h.onAdd).toHaveBeenCalled()
  })

  it('enters edit mode on a long press', () => {
    const h = setup()
    fireEvent(screen.getByLabelText('Toys'), 'longPress')
    expect(h.onEnterEdit).toHaveBeenCalled()
  })

  it('gives every tile the screen-reader moves the drag cannot offer', () => {
    const h = setup()
    const tile = screen.getByLabelText('Toys')
    expect(tile.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'moveEarlier',
      'moveLater',
      'moveTop',
      'remove',
    ])
    const act = (actionName: string) => fireEvent(tile, 'accessibilityAction', { nativeEvent: { actionName } })
    act('moveEarlier')
    expect(h.onMove).toHaveBeenLastCalledWith('b', 0)
    act('moveLater')
    expect(h.onMove).toHaveBeenLastCalledWith('b', 2)
    act('moveTop')
    expect(h.onMoveToTop).toHaveBeenCalledWith('b')
    act('remove')
    expect(h.onRemove).toHaveBeenCalledWith('b')
  })
})

describe('ShortcutGrid editing', () => {
  it('shows a minus badge that removes its shortcut', () => {
    const h = setup(true)
    fireEvent.press(screen.getByTestId('remove-c'))
    expect(h.onRemove).toHaveBeenCalledWith('c')
  })

  it('opens the manage menu on a tap and wires its three items', () => {
    const h = setup(true)
    fireEvent.press(screen.getByLabelText('Toys'))
    expect(h.onOpen).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText('Move to the top'))
    expect(h.onMoveToTop).toHaveBeenCalledWith('b')
    expect(screen.queryByText('Move to the top')).toBeNull()

    fireEvent.press(screen.getByLabelText('Toys'))
    fireEvent.press(screen.getByText('Open Toys'))
    expect(h.onOpen).toHaveBeenCalledWith(features[1])

    fireEvent.press(screen.getByLabelText('Toys'))
    fireEvent.press(screen.getByText('Remove from Home'))
    expect(h.onRemove).toHaveBeenCalledWith('b')
  })

  it('closes the menu when edit mode ends', () => {
    const h = setup(true)
    fireEvent.press(screen.getByLabelText('Toys'))
    screen.rerender(<ShortcutGrid features={features} editing={false} {...h} />)
    expect(screen.queryByText('Remove from Home')).toBeNull()
  })
})
