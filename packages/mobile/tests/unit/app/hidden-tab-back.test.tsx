// journeys: B05
import { View, Text } from 'react-native'
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'
import { renderRouter, screen, testRouter, fireEvent, act } from 'expo-router/testing-library'

// The header ✕ closes everything opened since the last screen with the tab bar
// and lands there, wherever the trail wandered (hidden tabs, screens pushed
// over the tabs). This runs the real tab layout and the real stack layouts on
// expo-router's own router, with stub screens.

jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null, refresh: () => {} }) }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const Stub = (name: string) =>
  function StubScreen() {
    return (
      <View>
        <Text>{name}</Text>
      </View>
    )
  }

const routes = () => ({
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(my)/_layout': () => <Stack screenOptions={stackScreenOptions} />,
  '(my)/toys/index': Stub('My toys'),
  '(tabs)/_layout': require('../../../app/(tabs)/_layout'),
  '(tabs)/home/_layout': require('../../../app/(tabs)/home/_layout'),
  '(tabs)/home/index': Stub('Home'),
  '(tabs)/map': Stub('Map'),
  '(tabs)/inbox': Stub('Inbox'),
  '(tabs)/me': Stub('Me'),
  '(tabs)/explore/_layout': require('../../../app/(tabs)/explore/_layout'),
  '(tabs)/explore/index': Stub('Explore'),
  '(tabs)/explore/recycling': Stub('Recycling'),
  '(tabs)/explore/challenges/index': Stub('Challenges'),
  '(tabs)/guides/_layout': require('../../../app/(tabs)/guides/_layout'),
  '(tabs)/guides/index': Stub('Guides'),
  '(tabs)/guides/[id]/index': Stub('Guide'),
  '(tabs)/toy-library/_layout': require('../../../app/(tabs)/toy-library/_layout'),
  '(tabs)/toy-library/index': Stub('Toys'),
  '(tabs)/toy-library/[id]': Stub('Toy'),
})

// The real layouts name screens these stubs leave out; expo-router warns once per stack.
beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))

let app: ReturnType<typeof renderRouter>
const close = () => act(() => fireEvent.press(screen.getByLabelText('Close')))
// The bar shows only on a tab's first screen, so seeing it proves the trail is gone.
const landed = (path: string) => {
  expect(app.getPathname()).toBe(path)
  expect(screen.queryByTestId('tab-bar')).not.toBeNull()
}

describe('The ✕ on a pushed screen', () => {
  it('goes Home when Home opened it', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/explore/recycling')
    close()
    landed('/home')
  })

  it('goes to Me when Me opened it', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.navigate('/me')
    testRouter.push('/explore/challenges')
    close()
    landed('/me')
  })

  it('goes to Inbox when Inbox opened it', () => {
    app = renderRouter(routes(), { initialUrl: '/inbox' })
    testRouter.push('/guides/abc')
    close()
    landed('/inbox')
  })

  it('closes a whole trail of guides in one tap', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides/a')
    testRouter.push('/guides/b')
    testRouter.push('/guides/c')
    close()
    landed('/home')
  })

  it('lands on the guide list when the trail started there', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides')
    testRouter.push('/guides/abc')
    testRouter.push('/guides/def')
    close()
    landed('/guides')
  })

  it('closes a screen pushed over the tabs along with the trail under it', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides')
    testRouter.push('/guides/abc')
    testRouter.push('/toys')
    close()
    landed('/guides')
  })
})

describe('The floating bar on a screen opened into a hidden tab', () => {
  const bar = () => screen.queryByTestId('tab-bar')

  it('is off a guide or toy opened straight from Home, as from a recents row', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    expect(bar()).not.toBeNull()
    testRouter.push('/guides/abc')
    expect(bar()).toBeNull()
    testRouter.navigate('/home')
    testRouter.push('/toy-library/xyz')
    expect(bar()).toBeNull()
  })

  it('stays on the list roots', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides')
    expect(bar()).not.toBeNull()
    testRouter.navigate('/home')
    testRouter.push('/toy-library')
    expect(bar()).not.toBeNull()
  })

  it('returns on the list root after a detail opened first', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides/abc')
    testRouter.navigate('/home')
    testRouter.push('/guides')
    expect(bar()).not.toBeNull()
  })
})
