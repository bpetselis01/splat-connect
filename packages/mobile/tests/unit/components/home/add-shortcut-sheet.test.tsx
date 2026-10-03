import { Platform, StyleSheet } from 'react-native'
import { act, render, screen, fireEvent } from '@testing-library/react-native'
import { AddShortcutSheet, claimsSheetDrag, shouldCloseSheet } from '../../../../components/home/add-shortcut-sheet'
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

describe('on iOS', () => {
  it('is a native page sheet, so the system swipe-down works from the header and the list', () => {
    open()
    const modal = screen.getByTestId('add-sheet-modal')
    expect(modal.props).toMatchObject({ presentationStyle: 'pageSheet', animationType: 'slide' })
    expect(modal.props.transparent).toBeFalsy()
    // No custom dim or drag handlers: the system owns the gesture.
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByTestId('add-sheet')).toBeNull()
    expect(screen.getByTestId('add-sheet-list')).toBeTruthy()
  })

  it('closes on the system dismiss (a swipe leaves visible true), back, and the screen-reader escape', () => {
    const onClose = open()
    fireEvent(screen.getByTestId('add-sheet-modal'), 'dismiss')
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent(screen.getByTestId('add-sheet-modal'), 'requestClose')
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent(screen.getByTestId('add-sheet-modal').findByProps({ onAccessibilityEscape: onClose }), 'accessibilityEscape')
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

// A one-finger move of `dy` as the responder system would hand it over.
let stamp = 0
const touch = (dy: number, ms = 100) => {
  const t = (stamp += ms)
  return {
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: t,
      touchBank: [{ touchActive: true, startPageX: 0, startPageY: 0, startTimeStamp: t - ms, currentPageX: 0, currentPageY: dy, currentTimeStamp: t, previousPageX: 0, previousPageY: 0, previousTimeStamp: t - ms }],
    },
    nativeEvent: {},
  }
}

describe('on Android and web', () => {
  let platform: { restore: () => void }
  beforeEach(() => {
    jest.useFakeTimers()
    platform = jest.replaceProperty(Platform, 'OS', 'android')
  })
  afterEach(() => {
    platform.restore()
    jest.useRealTimers()
  })
  const settle = () => act(() => { jest.advanceTimersByTime(3000) })
  const offset = () => (StyleSheet.flatten(screen.getByTestId('add-sheet').props.style) as { transform: { translateY: number }[] }).transform[0].translateY
  // Claim, grant, move and release one downward drag, each on its own event as the responder system sends them.
  const drag = (node: ReturnType<typeof screen.getByTestId>, dy: number) => {
    const h = node.props
    let claimed = false
    const claim = touch(dy)
    act(() => { claimed = h.onMoveShouldSetResponderCapture(claim) })
    if (!claimed) return false
    act(() => h.onResponderGrant(claim))
    act(() => h.onResponderMove(touch(dy)))
    act(() => h.onResponderRelease(touch(dy)))
    return true
  }

  it('closes from the dim after sliding out, and from back at once', () => {
    const onClose = open()
    settle()
    // Hidden from the screen reader by the modal sheet; the dim is for fingers.
    fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }))
    settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent(screen.getByTestId('add-sheet-modal'), 'requestClose')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('answers the screen-reader escape', () => {
    const onClose = open()
    settle()
    // Called directly: fireEvent skips a node whose responder says it is not interested.
    act(() => screen.getByTestId('add-sheet').props.onAccessibilityEscape())
    settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('add-sheet').props.accessibilityViewIsModal).toBe(true)
  })

  it('slides in from below and rests at 0', () => {
    open()
    settle()
    expect(offset()).toBeCloseTo(0, 1)
  })

  it('closes when the header is dragged down past 100', () => {
    const onClose = open()
    settle()
    expect(drag(screen.getByTestId('add-sheet-head'), 160)).toBe(true)
    settle()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back when the drag is short', () => {
    const onClose = open()
    settle()
    expect(drag(screen.getByTestId('add-sheet-head'), 60)).toBe(true)
    settle()
    expect(onClose).not.toHaveBeenCalled()
    expect(offset()).toBeCloseTo(0, 1)
  })

  it('takes the drag from the list at its top, but not once it has scrolled', () => {
    const onClose = open()
    settle()
    const sheet = screen.getByTestId('add-sheet')
    fireEvent.scroll(screen.getByTestId('add-sheet-list'), { nativeEvent: { contentOffset: { y: 200 } } })
    expect(drag(sheet, 160)).toBe(false)
    fireEvent.scroll(screen.getByTestId('add-sheet-list'), { nativeEvent: { contentOffset: { y: 0 } } })
    expect(drag(sheet, 160)).toBe(true)
    settle()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still drags from the header when the list has scrolled', () => {
    const onClose = open()
    settle()
    fireEvent.scroll(screen.getByTestId('add-sheet-list'), { nativeEvent: { contentOffset: { y: 200 } } })
    expect(drag(screen.getByTestId('add-sheet-head'), 160)).toBe(true)
    settle()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('drag maths', () => {
  it('claims only a downward, mostly vertical drag, and only from the top of a list', () => {
    expect(claimsSheetDrag({ dx: 0, dy: 20 })).toBe(true)
    expect(claimsSheetDrag({ dx: 0, dy: 3 })).toBe(false)
    expect(claimsSheetDrag({ dx: 0, dy: -20 })).toBe(false)
    expect(claimsSheetDrag({ dx: 30, dy: 20 })).toBe(false)
    expect(claimsSheetDrag({ dx: 0, dy: 20 }, 40)).toBe(false)
  })
  it('closes past 100 or on a fast fling, not otherwise', () => {
    expect(shouldCloseSheet({ dy: 101, vy: 0 })).toBe(true)
    expect(shouldCloseSheet({ dy: 30, vy: 2 })).toBe(true)
    expect(shouldCloseSheet({ dy: 60, vy: 0.3 })).toBe(false)
  })
})
