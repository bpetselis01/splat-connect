import { render, screen, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { TabBar } from '../../../components/tab-bar'
import { tabBarClearance } from '../../../lib/tab-bar-layout'

const routes = ['home', 'map', 'inbox', 'me', 'guides', 'toy-library', 'explore'].map((name, i) => ({ key: `${name}-${i}`, name }))
const titles: Record<string, string> = {
  home: 'Home', map: 'Map', inbox: 'Inbox', me: 'Me', guides: 'Guides', 'toy-library': 'Toys', explore: 'Explore',
}
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(
    routes.map((r) => [r.key, { options: { title: titles[r.name] } }])
  ),
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const at = (name: string, nested?: number) => {
  const index = routes.findIndex((r) => r.name === name)
  return {
    ...props,
    state: {
      ...props.state,
      index,
      routes: routes.map((r, i) => (i === index && nested !== undefined ? { ...r, state: { index: nested } } : r)),
    },
  }
}

it('draws exactly Home, Map, Inbox, Me in that order, and badges Inbox and Me', () => {
  render(<TabBar {...props} badges={{ inbox: 8, me: 3 }} />)
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel.split(',')[0])).toEqual(['Home', 'Map', 'Inbox', 'Me'])
  for (const hidden of ['Guides', 'Toys', 'Explore']) expect(screen.queryByText(hidden)).toBeNull()
  expect(screen.getByText('8')).toBeTruthy()
  expect(screen.getByLabelText('Inbox, 8 unread')).toBeTruthy()
  expect(screen.getByLabelText('Me, 3 waiting')).toBeTruthy()
  expect(screen.queryByLabelText(/^Home,/)).toBeNull()
})

it('navigates on a tap and marks the current tab selected', () => {
  render(<TabBar {...props} badges={{}} />)
  expect(screen.getByLabelText('Home').props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByLabelText('Me'))
  expect(props.navigation.navigate).toHaveBeenCalledWith('me')
})

it('highlights Home on the hidden Guides and Toys roots', () => {
  for (const name of ['guides', 'toy-library']) {
    render(<TabBar {...at(name, 0)} badges={{}} />)
    expect(screen.getByLabelText('Home').props.accessibilityState.selected).toBe(true)
    expect(screen.getByLabelText('Me').props.accessibilityState.selected).toBe(false)
    screen.unmount()
  }
})

it('tapping Home from the Guides root goes to Home, not nowhere', () => {
  props.navigation.navigate.mockClear()
  render(<TabBar {...at('guides', 0)} badges={{}} />)
  fireEvent.press(screen.getByLabelText('Home'))
  expect(props.navigation.navigate).toHaveBeenCalledWith('home')
})

it('hides on a pushed screen and on Explore, and shows on a tab root', () => {
  render(<TabBar {...at('guides', 1)} badges={{}} />)
  expect(screen.queryByText('Home')).toBeNull()
  screen.unmount()
  render(<TabBar {...at('home', 1)} badges={{}} />)
  expect(screen.queryByText('Home')).toBeNull()
  screen.unmount()
  for (const depth of [0, 1]) {
    render(<TabBar {...at('explore', depth)} badges={{}} />)
    expect(screen.queryByText('Home')).toBeNull()
    screen.unmount()
  }
  render(<TabBar {...at('toy-library', 0)} badges={{}} />)
  expect(screen.getByText('Home')).toBeTruthy()
})

it('hides on a drill-down screen that is alone in its stack', () => {
  // Opened from Home into an unvisited Guides stack: nothing under it, still not a root.
  const state = at('guides').state
  const lone = { ...state, routes: state.routes.map((r: { name: string }) => (r.name === 'guides' ? { ...r, state: { index: 0, routes: [{ name: '[id]/index' }] } } : r)) }
  render(<TabBar {...props} state={lone} badges={{}} />)
  expect(screen.queryByText('Home')).toBeNull()
})

it('floats: absolute, 14px margins, 16px off the edge, 66px tall, above the home indicator, over a blur', () => {
  render(<TabBar {...props} insets={{ top: 0, bottom: 34, left: 0, right: 0 }} badges={{}} />)
  const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style)
  expect(bar).toMatchObject({ position: 'absolute', left: 14, right: 14, height: 66, bottom: 34 })
  expect(screen.UNSAFE_getByType(BlurView)).toBeTruthy()
  screen.unmount()
  render(<TabBar {...props} badges={{}} />)
  expect(StyleSheet.flatten(screen.getByTestId('tab-bar').props.style).bottom).toBe(16)
})

it('tabBarClearance is bar + offset + 12', () => {
  expect(tabBarClearance(34)).toBe(66 + 34 + 12)
  expect(tabBarClearance(0)).toBe(66 + 16 + 12)
})

it('caps label scaling at 1.3 and shows 99+ for a badge over 99', () => {
  render(<TabBar {...props} badges={{ inbox: 150 }} />)
  expect(screen.getByText('Home').props.maxFontSizeMultiplier).toBe(1.3)
  expect(screen.getByText('99+')).toBeTruthy()
})

it('matches the board glass: 62% white, board shadow, pale-blue active pill, outline icons', () => {
  render(<TabBar {...props} badges={{}} />)
  const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style)
  expect(bar).toMatchObject({ backgroundColor: 'rgba(255,255,255,0.62)', shadowOpacity: 0.14, shadowRadius: 28, padding: 6 })
  expect(StyleSheet.flatten(screen.getByLabelText('Home').props.style)).toMatchObject({ backgroundColor: 'rgba(220,240,251,0.85)' })
  expect(StyleSheet.flatten(screen.getByLabelText('Map').props.style).backgroundColor).toBeUndefined()
})

it('the unread badge is dangerDeep with white 10.5 text, a white ring and the board size', () => {
  render(<TabBar {...props} badges={{ inbox: 3 }} />)
  const pill = StyleSheet.flatten(screen.getByTestId('tab-badge').props.style)
  expect(pill).toMatchObject({
    backgroundColor: '#b83a3a', minWidth: 21, height: 21, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  })
  expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject({ color: '#ffffff', fontSize: 10.5, lineHeight: 17 })
})
