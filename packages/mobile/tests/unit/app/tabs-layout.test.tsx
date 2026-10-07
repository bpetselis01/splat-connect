import { render } from '@testing-library/react-native'
import TabsLayout from '../../../app/(tabs)/_layout'

const screens: { name: string; options: { title?: string; href?: null } }[] = []
jest.mock('expo-router', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>
  Tabs.Screen = (p: { name: string; options: { title?: string; href?: null } }) => {
    screens.push(p)
    return null
  }
  return { Tabs, Redirect: () => null, usePathname: () => '/home' }
})
jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, refresh: jest.fn() }) }))

it('lists Home, Map, Inbox, Me first and hides Guides, Toys and Explore', () => {
  render(<TabsLayout />)
  expect(screens.slice(0, 4).map((s) => [s.name, s.options.title])).toEqual([
    ['home', 'Home'], ['map', 'Map'], ['inbox', 'Inbox'], ['me', 'Me'],
  ])
  for (const name of ['guides', 'toy-library', 'explore']) {
    expect(screens.find((s) => s.name === name)?.options.href).toBeNull()
  }
})
