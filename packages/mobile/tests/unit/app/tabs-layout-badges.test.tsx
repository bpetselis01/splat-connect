import { render } from '@testing-library/react-native'
import TabsLayout from '../../../app/(tabs)/_layout'

let mockBadges: Record<string, number> | undefined
jest.mock('expo-router', () => {
  const Tabs = ({ tabBar }: { tabBar: (p: object) => React.ReactElement }) => tabBar({})
  Tabs.Screen = () => null
  return { Tabs, Redirect: () => null }
})
jest.mock('../../../components/tab-bar', () => ({
  TabBar: (p: { badges: Record<string, number> }) => { mockBadges = p.badges; return null },
}))
jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
let mockCaps: unknown = null
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))

const caps = (total: number | null | undefined, actions: number | null | undefined) => ({
  unread: total === undefined ? undefined : { total },
  exchangeActions: actions,
})

beforeEach(() => { mockBadges = undefined })

it('badges Inbox with total unread and Me with exchange actions, from the one caps object', () => {
  mockCaps = caps(7, 3)
  render(<TabsLayout />)
  expect(mockBadges).toEqual({ inbox: 7, me: 3 })
})

it('shows no badges before capabilities load, or when they failed to', () => {
  mockCaps = null
  render(<TabsLayout />)
  expect(mockBadges).toEqual({ inbox: 0, me: 0 })
})

it('treats null counts as zero rather than passing null to the bar', () => {
  mockCaps = caps(null, null)
  render(<TabsLayout />)
  expect(mockBadges).toEqual({ inbox: 0, me: 0 })
})
