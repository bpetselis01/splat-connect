import { render, screen, fireEvent } from '@testing-library/react-native'
import { TabBar } from '../../../components/tab-bar'

const routes = ['home', 'map', 'inbox', 'me'].map((name, i) => ({ key: `${name}-${i}`, name }))
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name[0].toUpperCase() + r.name.slice(1) } }])),
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

describe('tab badge count math', () => {
  it.each([
    ['zero', 0],
    ['negative (a count that raced below zero)', -3],
    ['NaN', NaN],
    ['missing', undefined],
  ])('H07 hides the badge for %s', (_l, v) => {
    render(<TabBar {...props} badges={{ inbox: v as number, me: v as number }} />)
    expect(screen.queryByTestId('tab-badge')).toBeNull()
    expect(screen.getByLabelText('Inbox')).toBeTruthy()
    expect(screen.getByLabelText('Me')).toBeTruthy()
  })

  it.each([
    [1, '1'], [9, '9'], [99, '99'], [100, '99+'], [101, '99+'], [1_000_000, '99+'],
  ])('H07 shows %i as %s', (count, text) => {
    render(<TabBar {...props} badges={{ inbox: count }} />)
    expect(screen.getByTestId('tab-badge')).toHaveTextContent(text)
  })

  it('H07 reads the unread phrase for Inbox and the waiting phrase for Me, with the true count even past 99', () => {
    render(<TabBar {...props} badges={{ inbox: 250, me: 1 }} />)
    expect(screen.getByLabelText('Inbox, 250 unread')).toBeTruthy()
    expect(screen.getByLabelText('Me, 1 waiting')).toBeTruthy()
  })

  it('H07 a badged tab is still pressable and navigates', () => {
    props.navigation.navigate.mockClear()
    render(<TabBar {...props} badges={{ inbox: 4 }} />)
    fireEvent.press(screen.getByLabelText('Inbox, 4 unread'))
    expect(props.navigation.navigate).toHaveBeenCalledWith('inbox')
  })

  it('does not navigate when a listener prevents the tab press', () => {
    props.navigation.navigate.mockClear()
    const prevented = { ...props, navigation: { emit: jest.fn(() => ({ defaultPrevented: true })), navigate: jest.fn() } }
    render(<TabBar {...prevented} badges={{}} />)
    fireEvent.press(screen.getByLabelText('Me'))
    expect(prevented.navigation.navigate).not.toHaveBeenCalled()
  })

  it('tapping the tab you are on does not navigate again', () => {
    props.navigation.navigate.mockClear()
    render(<TabBar {...props} badges={{}} />)
    fireEvent.press(screen.getByLabelText('Home'))
    expect(props.navigation.navigate).not.toHaveBeenCalled()
  })
})
