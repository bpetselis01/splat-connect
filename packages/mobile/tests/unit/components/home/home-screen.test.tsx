// packages/mobile/tests/unit/components/home/home-screen.test.tsx
import { ScrollView, StyleSheet, Text } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { HomeScreen } from '../../../../components/home/home-screen'
import { theme } from '../../../../lib/theme'
import { tabBarClearance } from '../../../../lib/tab-bar-layout'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

let mockUnread = { total: 2, exchanges: 2 }
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockUnread.total === -1 ? null : { unread: mockUnread } }),
}))

const mockShortcuts = {
  features: [
    { id: 'a', name: 'Guides', icon: 'book-outline', tint: 'honey', group: 'Learn and build', href: '/guides' },
    { id: 'b', name: 'Toys', icon: 'cube-outline', tint: 'apr', group: 'Toys', href: '/toy-library' },
  ],
  ids: ['a', 'b'],
  ready: true,
  add: jest.fn(),
  remove: jest.fn(),
  move: jest.fn(),
  moveToTop: jest.fn(),
  reset: jest.fn(),
}
jest.mock('../../../../lib/home-shortcuts', () => ({ useHomeShortcuts: () => mockShortcuts }))

let mockRecents: unknown[] = [{ key: 'guide:1' }]
jest.mock('../../../../lib/recents', () => ({ useRecents: () => ({ recents: mockRecents, ready: true, clear: jest.fn() }) }))

jest.mock('../../../../components/home/recent-rows', () => {
  const { Text } = require('react-native')
  return { RecentRows: () => <Text>recent rows</Text> }
}, { virtual: true })
jest.mock('../../../../components/home/add-shortcut-sheet', () => {
  const { Text } = require('react-native')
  return { AddShortcutSheet: ({ visible }: { visible: boolean }) => (visible ? <Text>add sheet open</Text> : null) }
})

function setup() {
  render(<HomeScreen />)
  fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 0 } } })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUnread = { total: 2, exchanges: 2 }
  mockRecents = [{ key: 'guide:1' }]
})

describe('HomeScreen', () => {
  it('is the mockup: a Home title with Edit, and no hero, search or stats', () => {
    setup()
    expect(screen.getByText('Home')).toBeTruthy()
    expect(screen.getByLabelText('Edit')).toBeTruthy()
    expect(screen.queryByText('Welcome to SPLAT')).toBeNull()
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull()
    expect(screen.queryByText('This community so far')).toBeNull()
    const title = StyleSheet.flatten(screen.getByText('Home').props.style) as Record<string, unknown>
    expect(title).toMatchObject({ fontFamily: theme.fonts.display, fontSize: 30 })
  })

  it('puts the title and Edit on one centred line, whatever Baloo 2 reports as its height', () => {
    setup()
    const bar = StyleSheet.flatten(screen.getByTestId('home-topbar').props.style) as Record<string, number | string>
    expect(bar).toMatchObject({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' })
    const title = StyleSheet.flatten(screen.getByText('Home').props.style) as Record<string, number>
    // Baloo 2 is 1.602em tall (hhea 1078 + 524), so a 30px title boxed at 33
    // sits low on iOS. The box is the font's own height, pulled back by margins
    // so the row still measures 33.
    expect(title.lineHeight).toBe(48)
    expect(title.lineHeight + 2 * title.marginVertical).toBe(33)
    const edit = StyleSheet.flatten(screen.getByLabelText('Edit').props.style) as Record<string, number>
    expect(edit).toMatchObject({ paddingVertical: 8, paddingHorizontal: 14 })
    expect(StyleSheet.flatten(screen.getByText('Edit').props.style)).toMatchObject({ fontSize: 14 })
  })

  it('sits on the page ground and clears the floating tab bar', () => {
    setup()
    const frame = screen.UNSAFE_getByType(ScrollView)
    const f = StyleSheet.flatten(frame.props.style) as { marginHorizontal?: number }
    // The gutter and the tab-bar clearance sit inside the background tap
    // target, so the whole page, not just the middle, answers a tap.
    const c = StyleSheet.flatten(screen.getByTestId('home-background').props.style) as { paddingHorizontal?: number; paddingBottom?: number }
    expect(f.marginHorizontal).toBe(-16)
    expect(c.paddingHorizontal).toBe(16)
    expect(c.paddingBottom).toBe(tabBarClearance(0))
  })

  it('opens the shortcut it is tapped on, and the Add sheet from Add', () => {
    setup()
    fireEvent.press(screen.getByLabelText('Toys'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library')
    expect(screen.queryByText('add sheet open')).toBeNull()
    fireEvent.press(screen.getByLabelText('Add a shortcut'))
    expect(screen.getByText('add sheet open')).toBeTruthy()
  })

  it('shows recents under their own title', () => {
    setup()
    expect(screen.getByText('Pick up where you left off')).toBeTruthy()
    expect(screen.getByText('recent rows')).toBeTruthy()
  })

  it('leaves out the recents title while there is nothing under it', () => {
    mockRecents = []
    setup()
    expect(screen.queryByText('Pick up where you left off')).toBeNull()
  })

  describe('Today card', () => {
    it('counts the unread messages and opens the Inbox', () => {
      setup()
      expect(screen.getByText('2 new messages')).toBeTruthy()
      fireEvent.press(screen.getByLabelText(/2 new messages/))
      expect(mockPush).toHaveBeenCalledWith('/inbox')
    })

    it('says "message" for one, and names the exchange only when that is all it is', () => {
      mockUnread = { total: 1, exchanges: 0 }
      setup()
      expect(screen.getByText('1 new message')).toBeTruthy()
      expect(screen.queryByText(/toy exchange/)).toBeNull()
    })

    it('is gone when there is nothing new, or nothing loaded', () => {
      mockUnread = { total: 0, exchanges: 0 }
      setup()
      expect(screen.queryByText(/new message/)).toBeNull()
    })
  })

  describe('edit mode', () => {
    it('toggles Edit and Done, with the hint and without the Today card', () => {
      setup()
      expect(screen.queryByText('Drag to reorder. Let go and a menu appears.')).toBeNull()
      fireEvent.press(screen.getByLabelText('Edit'))
      expect(screen.getByLabelText('Done')).toBeTruthy()
      expect(screen.getByText('Drag to reorder. Let go and a menu appears.')).toBeTruthy()
      expect(screen.queryByText('2 new messages')).toBeNull()
      expect(screen.queryByText('recent rows')).toBeNull()
      fireEvent.press(screen.getByLabelText('Done'))
      expect(screen.getByLabelText('Edit')).toBeTruthy()
    })

    it('fills the screen with a tap target, so the empty space below the content answers a tap', () => {
      setup()
      const frame = screen.UNSAFE_getByType(ScrollView)
      expect(StyleSheet.flatten(frame.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 })
      expect(StyleSheet.flatten(screen.getByTestId('home-background').props.style)).toMatchObject({ flexGrow: 1 })
      // Not a screen-reader stop: the tiles inside it must stay reachable.
      expect(screen.getByTestId('home-background').props.accessible).toBe(false)
      // And never disabled, which on web would disable the controls inside it.
      expect(screen.getByTestId('home-background').props.accessibilityState?.disabled).toBeFalsy()
      expect(screen.getByLabelText('Edit').props.accessibilityState?.disabled).toBeFalsy()
    })

    it('does nothing for a background tap at rest, and leaves edit mode when tapped in it', () => {
      setup()
      fireEvent.press(screen.getByTestId('home-background'))
      expect(screen.getByLabelText('Edit')).toBeTruthy()
      fireEvent.press(screen.getByLabelText('Edit'))
      fireEvent.press(screen.getByTestId('home-background'))
      expect(screen.getByLabelText('Edit')).toBeTruthy()
      expect(screen.queryByText('Drag to reorder. Let go and a menu appears.')).toBeNull()
    })

    it('closes an open manage menu first, and the next tap leaves edit mode', () => {
      setup()
      fireEvent.press(screen.getByLabelText('Edit'))
      fireEvent.press(screen.getByLabelText('Toys'))
      expect(screen.getByText('Remove from Home')).toBeTruthy()
      fireEvent.press(screen.getByTestId('home-background'))
      expect(screen.queryByText('Remove from Home')).toBeNull()
      expect(screen.getByLabelText('Done')).toBeTruthy()
      fireEvent.press(screen.getByTestId('home-background'))
      expect(screen.getByLabelText('Edit')).toBeTruthy()
    })

    it('does not leave edit mode for taps on the controls themselves', () => {
      setup()
      fireEvent.press(screen.getByLabelText('Edit'))
      fireEvent.press(screen.getByLabelText('Toys'))
      fireEvent.press(screen.getByText('Move to the top'))
      fireEvent.press(screen.getByTestId('remove-a'))
      fireEvent.press(screen.getByLabelText('Add a shortcut'))
      expect(screen.getByLabelText('Done')).toBeTruthy()
      expect(screen.getByText('add sheet open')).toBeTruthy()
    })

    it('enters on a long press and removes through the hook', () => {
      setup()
      fireEvent(screen.getByLabelText('Toys'), 'longPress')
      expect(screen.getByLabelText('Done')).toBeTruthy()
      fireEvent.press(screen.getByTestId('remove-b'))
      expect(mockShortcuts.remove).toHaveBeenCalledWith('b')
    })
  })
})
