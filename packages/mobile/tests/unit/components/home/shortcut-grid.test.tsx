// packages/mobile/tests/unit/components/home/shortcut-grid.test.tsx
import { useState } from 'react'
import { PixelRatio, StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ShortcutGrid, slotAt, slotPos, reorder, tileMetrics } from '../../../../components/home/shortcut-grid'
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

// The jest runtime reports a font scale of 2; pin the ordinary one.
beforeEach(() => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1)
})
afterEach(() => jest.restoreAllMocks())

// Home owns which tile's menu is open, so a tap on the background can close it.
function Harness({ editing, ...h }: { editing: boolean } & Omit<React.ComponentProps<typeof ShortcutGrid>, 'features' | 'editing' | 'menuId' | 'onMenuId'>) {
  const [menuId, setMenuId] = useState<string | null>(null)
  return <ShortcutGrid features={features} editing={editing} menuId={menuId} onMenuId={setMenuId} {...h} />
}

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
  render(<Harness editing={editing} {...h} />)
  // 358 = a 390 phone less the 16px gutters: columns of (358 - 3*6) / 4 = 85.
  fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 0 } } })
  return h
}

describe('grid maths', () => {
  it('sizes the glyph to the column: ~75 on a 390 phone, smaller at 320, capped at 76', () => {
    expect(tileMetrics(85)).toMatchObject({ glyph: 75, radius: 24 })
    expect(tileMetrics(67.5).glyph).toBe(59)
    expect(tileMetrics(120).glyph).toBe(76)
  })
  it('boxes two lines of 13/16 label under the glyph, and grows with font scale up to 1.3', () => {
    expect(tileMetrics(85, 1)).toMatchObject({ labelH: 32, cellH: 75 + 6 + 32, pitchY: 75 + 6 + 32 + 18 })
    expect(tileMetrics(85, 2).labelH).toBe(42)
  })
  it('lays four across at gap 6 by 18', () => {
    expect(slotPos(0, 85)).toEqual({ x: 0, y: 0 })
    expect(slotPos(3, 85)).toEqual({ x: 3 * 91, y: 0 })
    expect(slotPos(5, 85)).toEqual({ x: 91, y: 131 })
  })
  it('reads the nearest slot, clamped to the tiles that exist', () => {
    expect(slotAt(95, 4, 85, 8)).toBe(1)
    expect(slotAt(0, 130, 85, 8)).toBe(4)
    expect(slotAt(900, 900, 85, 6)).toBe(5)
    expect(slotAt(-50, -50, 85, 6)).toBe(0)
  })
  it('moves one id to a slot, shifting the rest', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(reorder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })
})

describe('ShortcutGrid height', () => {
  it('gives a last row holding only Add one line of label, as the mockup does', () => {
    setup()
    // 3 shortcuts + Add fill one row: two lines of label.
    expect(StyleSheet.flatten(screen.getByTestId('shortcut-grid').props.style)).toMatchObject({ height: 75 + 6 + 32 })
    screen.unmount()
    const eight = Array.from({ length: 8 }, (_, i) => F(`f${i}`, `Tile ${i}`))
    render(<ShortcutGrid features={eight} editing={false} menuId={null} onMenuId={jest.fn()} onOpen={jest.fn()} onAdd={jest.fn()} onEnterEdit={jest.fn()} onRemove={jest.fn()} onMove={jest.fn()} onMoveToTop={jest.fn()} />)
    fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 0 } } })
    // Two full rows, then Add alone on a third.
    expect(StyleSheet.flatten(screen.getByTestId('shortcut-grid').props.style)).toMatchObject({ height: 2 * 131 + 75 + 6 + 16 })
  })
})

describe('ShortcutGrid at rest', () => {
  it('draws a labelled tile per shortcut, tinted, and a dashed Add tile', () => {
    setup()
    expect(screen.getByText('Guides')).toBeTruthy()
    const glyph = StyleSheet.flatten(screen.getByTestId('glyph-a').props.style) as Record<string, unknown>
    expect(glyph).toMatchObject({ width: 75, height: 75, borderRadius: 24, backgroundColor: theme.colors.honeySoft })
    // A stronger shadow than the old elevation 2, so the tiles stand off the page.
    expect(glyph).toMatchObject({ shadowOpacity: 0.14, shadowOffset: { width: 0, height: 6 } })
    const label = StyleSheet.flatten(screen.getByText('Guides').props.style) as Record<string, unknown>
    expect(label).toMatchObject({ fontSize: theme.type.caption, lineHeight: 16, height: 32 })
    expect(screen.getByText('Guides').props.maxFontSizeMultiplier).toBe(1.3)
    expect(screen.getByText('Guides').props.numberOfLines).toBe(2)
    const add = StyleSheet.flatten(screen.getByTestId('glyph-add').props.style) as Record<string, unknown>
    expect(add).toMatchObject({ borderStyle: 'dashed', borderWidth: 2 })
    expect(screen.queryByTestId('remove-a')).toBeNull()
  })

  it('draws the icons at 32 and still fits four across a 320 phone', () => {
    setup()
    expect(screen.getByTestId('glyph-a').findByProps({ name: 'book-outline' }).props.size).toBe(32)
    screen.unmount()
    render(<Harness editing={false} onOpen={jest.fn()} onAdd={jest.fn()} onEnterEdit={jest.fn()} onRemove={jest.fn()} onMove={jest.fn()} onMoveToTop={jest.fn()} />)
    // 288 = a 320 phone less the gutters: columns of 67.5, so a 59 glyph.
    fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 288, height: 0 } } })
    const glyph = StyleSheet.flatten(screen.getByTestId('glyph-a').props.style) as { width: number }
    expect(glyph.width).toBeLessThanOrEqual(67.5)
  })

  it('H03 opens a shortcut on press and the add sheet on Add', () => {
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

  it('H04 opens the manage menu on a tap and wires its three items', () => {
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
    screen.rerender(<Harness editing={false} {...h} />)
    expect(screen.queryByText('Remove from Home')).toBeNull()
  })
})
