import { View, Text } from 'react-native'
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'
import { renderRouter, screen, testRouter, fireEvent, act } from 'expo-router/testing-library'

// Home, Me and Inbox open screens that live in a hidden tab's stack (/explore,
// /guides, /toy-library). Back from one must return to whoever opened it, and
// a stack must not remember the visit before: this runs the real tab layout and
// the real stack layouts on expo-router's own router, with stub screens.

jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))
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
})

// The real layouts name screens these stubs leave out; expo-router warns once per stack.
beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))

let app: ReturnType<typeof renderRouter>
const back = () => act(() => fireEvent.press(screen.getByLabelText('Back')))

describe('Back from a screen opened into a hidden tab', () => {
  it('goes Home when Home opened it, however many hidden screens came before', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/explore/recycling')
    back()
    expect(app.getPathname()).toBe('/home')
    testRouter.push('/explore/challenges')
    back()
    expect(app.getPathname()).toBe('/home')
  })

  it('goes to Me when Me opened it', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/explore/recycling')
    back()
    testRouter.navigate('/me')
    testRouter.push('/explore/challenges')
    back()
    expect(app.getPathname()).toBe('/me')
  })

  it('goes to Inbox when Inbox opened it', () => {
    app = renderRouter(routes(), { initialUrl: '/inbox' })
    testRouter.push('/guides/abc')
    back()
    expect(app.getPathname()).toBe('/inbox')
  })

  it('goes Home from a guide opened off Home, not to the Guides list', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides/first')
    back()
    testRouter.push('/guides/abc')
    back()
    expect(app.getPathname()).toBe('/home')
  })

  it('still goes back one screen inside the stack it is drilling through', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides')
    testRouter.push('/guides/abc')
    back()
    expect(app.getPathname()).toBe('/guides')
    back()
    expect(app.getPathname()).toBe('/home')
  })

  it('keeps the stack it was drilling through when a screen is pushed over the tabs', () => {
    app = renderRouter(routes(), { initialUrl: '/home' })
    testRouter.push('/guides')
    testRouter.push('/guides/abc')
    testRouter.push('/toys')
    back()
    expect(app.getPathname()).toBe('/guides/abc')
  })
})
