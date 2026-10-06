import { render, screen, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { TabBar } from '../../../components/tab-bar'
import { tabBarClearance } from '../../../lib/tab-bar-layout'
import { resetLastTab } from '../../../lib/tab-bar-routes'
import { theme } from '../../../lib/theme'

let mockSegments: string[] = ['(tabs)', 'home']
let mockSession: object | null = { user: { id: 'me' } }
let mockCaps: unknown = null
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  useSegments: () => mockSegments,
  usePathname: () => '/' + mockSegments.join('/'),
}))
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => mockInsets,
}))

const caps = (total: unknown, actions: unknown) => ({ unread: { total }, exchangeActions: actions })

beforeEach(() => {
  mockSegments = ['(tabs)', 'home']
  mockSession = { user: { id: 'me' } }
  mockCaps = null
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  mockNavigate.mockClear()
  resetLastTab()
})

it('draws exactly Home, Map, Inbox, Me in that order, and badges Inbox and Me', () => {
  mockCaps = caps(8, 3)
  render(<TabBar />)
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel.split(',')[0])).toEqual(['Home', 'Map', 'Inbox', 'Me'])
  expect(screen.getByLabelText('Inbox, 8 unread')).toBeTruthy()
  expect(screen.getByLabelText('Me, 3 waiting')).toBeTruthy()
  expect(screen.queryByLabelText(/^Home,/)).toBeNull()
})

it('navigates to the tab root on a tap, from anywhere, and marks the current tab selected', () => {
  mockSegments = ['(tabs)', 'guides', '[id]']
  render(<TabBar />)
  expect(screen.getByLabelText('Home').props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByLabelText('Me'))
  expect(mockNavigate).toHaveBeenCalledWith('/me')
  fireEvent.press(screen.getByLabelText('Home'))
  expect(mockNavigate).toHaveBeenCalledWith('/home')
})

it('lights the tab you came from on a screen pushed over the tabs', () => {
  mockSegments = ['(tabs)', 'map']
  render(<TabBar />)
  screen.unmount()
  mockSegments = ['(my)', 'saved']
  render(<TabBar />)
  expect(screen.getByLabelText('Map').props.accessibilityState.selected).toBe(true)
})

it('is absent signed out, in a chat, in build mode and in a first run', () => {
  mockSession = null
  render(<TabBar />)
  expect(screen.queryByTestId('tab-bar')).toBeNull()
  screen.unmount()
  mockSession = { user: { id: 'me' } }
  for (const s of [['(my)', 'exchanges', '[id]'], ['(tabs)', 'guides', '[id]', 'build'], ['(onboarding)', 'child']]) {
    mockSegments = s
    render(<TabBar />)
    expect(screen.queryByTestId('tab-bar')).toBeNull()
    screen.unmount()
  }
})

describe('badge count math', () => {
  it.each([
    ['zero', 0],
    ['negative (a count that raced below zero)', -3],
    ['NaN', NaN],
    ['missing', undefined],
    ['null', null],
  ])('hides the badge for %s', (_l, v) => {
    mockCaps = caps(v, v)
    render(<TabBar />)
    expect(screen.queryByTestId('tab-badge')).toBeNull()
    expect(screen.getByLabelText('Inbox')).toBeTruthy()
    expect(screen.getByLabelText('Me')).toBeTruthy()
  })

  it.each([
    [1, '1'], [99, '99'], [100, '99+'], [1_000_000, '99+'],
  ])('shows %i as %s', (count, text) => {
    mockCaps = caps(count, 0)
    render(<TabBar />)
    expect(screen.getByTestId('tab-badge')).toHaveTextContent(text)
  })

  it('reads the true count aloud even past 99', () => {
    mockCaps = caps(250, 1)
    render(<TabBar />)
    expect(screen.getByLabelText('Inbox, 250 unread')).toBeTruthy()
  })
})

it('floats: absolute, 14px margins, 16px off the edge, 66px tall, above the home indicator, over a blur', () => {
  mockInsets = { top: 0, bottom: 34, left: 0, right: 0 }
  render(<TabBar />)
  const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style)
  expect(bar).toMatchObject({ position: 'absolute', left: 14, right: 14, height: 66, bottom: 34 })
  expect(screen.UNSAFE_getByType(BlurView)).toBeTruthy()
  screen.unmount()
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  render(<TabBar />)
  expect(StyleSheet.flatten(screen.getByTestId('tab-bar').props.style).bottom).toBe(16)
})

it('tabBarClearance is bar + offset + 12', () => {
  expect(tabBarClearance(34)).toBe(66 + 34 + 12)
  expect(tabBarClearance(0)).toBe(66 + 16 + 12)
})

it('caps label scaling at 1.3', () => {
  render(<TabBar />)
  expect(screen.getByText('Home').props.maxFontSizeMultiplier).toBe(1.3)
})

it('matches the board glass: 62% white, board shadow, pale-blue active pill, outline icons', () => {
  render(<TabBar />)
  const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style)
  expect(bar).toMatchObject({ backgroundColor: 'rgba(255,255,255,0.62)', shadowOpacity: 0.14, shadowRadius: 28, padding: 6 })
  expect(StyleSheet.flatten(screen.getByLabelText('Home').props.style)).toMatchObject({ backgroundColor: 'rgba(220,240,251,0.85)' })
  expect(StyleSheet.flatten(screen.getByLabelText('Map').props.style).backgroundColor).toBeUndefined()
})

it('the unread badge is dangerDeep with white 10.5 text, a white ring and the board size', () => {
  mockCaps = caps(3, 0)
  render(<TabBar />)
  const pill = StyleSheet.flatten(screen.getByTestId('tab-badge').props.style)
  expect(pill).toMatchObject({
    backgroundColor: '#b83a3a', minWidth: 21, height: 21, borderWidth: 2, borderColor: theme.colors.surface,
  })
  expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject({ color: '#ffffff', fontSize: theme.type.micro, lineHeight: 17 })
})
