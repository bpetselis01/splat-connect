import { StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { RecentRows } from '../../../../components/home/recent-rows'
import { theme } from '../../../../lib/theme'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

let mockRecents: unknown[] = []
jest.mock('../../../../lib/recents', () => ({
  useRecents: () => ({ recents: mockRecents, ready: true, clear: jest.fn() }),
}))

const R = (kind: string, over: object = {}) => ({
  key: `${kind}:1`, kind, title: `${kind} title`, subtitle: `${kind} sub`, href: `/${kind}/1`, at: 1, ...over,
})
beforeEach(() => {
  jest.clearAllMocks()
  mockRecents = []
})

it('draws nothing when there are no recents', () => {
  const { toJSON } = render(<RecentRows />)
  expect(toJSON()).toBeNull()
})

it('draws a row per recent with title, subtitle and badge pill', () => {
  mockRecents = [R('guide', { title: 'Switch-adapted bus', subtitle: 'Guide · 25 min build', badge: 'Easy' }), R('toy')]
  render(<RecentRows />)
  expect(screen.getByText('Switch-adapted bus')).toBeTruthy()
  expect(screen.getByText('Guide · 25 min build')).toBeTruthy()
  expect(screen.getByText('Easy')).toBeTruthy()
  expect(screen.getByText('toy title')).toBeTruthy()
  expect(screen.getAllByTestId('recent-badge')).toHaveLength(1)
})

it('tints each kind as the board does', () => {
  const tints: Record<string, string> = {
    guide: theme.colors.accentLight, toy: theme.colors.apricotSoft, event: theme.colors.honeySoft,
    printer: theme.colors.violetSoft, recycling: theme.colors.mintSoft, challenge: theme.colors.honeySoft,
    organisation: theme.colors.surfaceSunken,
  }
  mockRecents = Object.keys(tints).map((k) => R(k))
  render(<RecentRows />)
  const icons = screen.getAllByTestId('recent-icon')
  Object.values(tints).forEach((bg, i) => {
    expect(StyleSheet.flatten(icons[i].props.style)).toMatchObject({ width: 44, height: 44, backgroundColor: bg })
  })
})

it('opens the saved href on press', () => {
  mockRecents = [R('event', { title: 'Open day', href: '/events/9' })]
  render(<RecentRows />)
  fireEvent.press(screen.getByText('Open day'))
  expect(mockPush).toHaveBeenCalledWith('/events/9')
})
