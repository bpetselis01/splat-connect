import { render, screen, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { TabBar } from '../../../components/tab-bar'
import { tabBarClearance } from '../../../lib/tab-bar-layout'

const routes = ['guides', 'toy-library', 'explore', 'inbox', 'me'].map((name, i) => ({ key: `${name}-${i}`, name }))
const titles: Record<string, string> = { guides: 'Guides', 'toy-library': 'Toys', explore: 'Explore', inbox: 'Inbox', me: 'Me' }
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(
    routes.map((r) => [r.key, { options: { title: titles[r.name] } }])
  ),
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

it('draws four tabs, no button for Explore, and badges Inbox and Me', () => {
  render(<TabBar {...props} badges={{ inbox: 8, me: 3 }} />)
  for (const label of ['Guides', 'Toys', 'Inbox', 'Me']) expect(screen.getByText(label)).toBeTruthy()
  expect(screen.queryByText('Explore')).toBeNull()
  expect(screen.getByText('8')).toBeTruthy()
  expect(screen.getByLabelText('Inbox, 8 unread')).toBeTruthy()
  expect(screen.getByLabelText('Me, 3 waiting')).toBeTruthy()
})

it('navigates on a tap and marks the current tab selected', () => {
  render(<TabBar {...props} badges={{}} />)
  expect(screen.getByLabelText('Guides').props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByLabelText('Me'))
  expect(props.navigation.navigate).toHaveBeenCalledWith('me')
})

// The board draws the tab bar on the four tab roots only: a screen pushed on
// a tab's stack, and Explore (reached from Me), go without it.
it('hides on a pushed screen and on Explore, and shows on a tab root', () => {
  const at = (index: number, nested?: number) => ({
    ...props,
    state: {
      ...props.state,
      index,
      routes: routes.map((r, i) => (i === index && nested !== undefined ? { ...r, state: { index: nested } } : r)),
    },
  })
  render(<TabBar {...at(1, 1)} badges={{}} />)
  expect(screen.queryByText('Toys')).toBeNull()
  screen.unmount()
  render(<TabBar {...at(2, 0)} badges={{}} />)
  expect(screen.queryByText('Guides')).toBeNull()
  screen.unmount()
  render(<TabBar {...at(1, 0)} badges={{}} />)
  expect(screen.getByText('Toys')).toBeTruthy()
})

it('floats: absolute, 14px margins, 66px tall, above the home indicator, over a blur', () => {
  render(<TabBar {...props} insets={{ top: 0, bottom: 34, left: 0, right: 0 }} badges={{}} />)
  const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style)
  expect(bar).toMatchObject({ position: 'absolute', left: 14, right: 14, height: 66, bottom: 34 })
  expect(screen.UNSAFE_getByType(BlurView)).toBeTruthy()
  screen.unmount()
  render(<TabBar {...props} badges={{}} />)
  expect(StyleSheet.flatten(screen.getByTestId('tab-bar').props.style).bottom).toBe(14)
})

it('tabBarClearance is bar + offset + 12', () => {
  expect(tabBarClearance(34)).toBe(66 + 34 + 12)
  expect(tabBarClearance(0)).toBe(66 + 14 + 12)
})

it('caps label scaling at 1.3 and shows 99+ for a badge over 99', () => {
  render(<TabBar {...props} badges={{ inbox: 150 }} />)
  expect(screen.getByText('Guides').props.maxFontSizeMultiplier).toBe(1.3)
  expect(screen.getByText('99+')).toBeTruthy()
})
