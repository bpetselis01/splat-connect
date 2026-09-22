import { render, screen, fireEvent } from '@testing-library/react-native'
import { TabBar } from '../../../components/tab-bar'

const routes = ['guides', 'toy-library', 'explore', 'inbox', 'me'].map((name, i) => ({ key: `${name}-${i}`, name }))
const titles: Record<string, string> = { guides: 'Guides', 'toy-library': 'Toys', explore: 'Explore', inbox: 'Inbox', me: 'Me' }
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(
    routes.map((r) => [r.key, { options: { title: titles[r.name], href: r.name === 'explore' ? null : undefined } }])
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
