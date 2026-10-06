import { render, screen, fireEvent } from '@testing-library/react-native'
import { FEATURES } from '../../../lib/home-shortcuts'
import { stackScreenOptions } from '../../../lib/nav-options'
import { BackButton } from '../../../components/ui/BackButton'
import { BAR_ROOTS } from '../../../components/tab-bar'

// Home pushes straight to a screen that may be the first of its stack (a hidden
// tab's stack was never opened, so React Navigation makes that screen the
// initial one and `canGoBack` is false). Every shortcut must still leave a way
// back: the tab bar, or a header control that falls back to Home.

type Opts = { headerShown?: boolean; headerLeft?: (p: { canGoBack?: boolean }) => React.ReactNode }
const mockScreens = new Map<string, Record<string, Opts>>()
let mockCurrent = ''
const mockRouter = { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn() }
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>
  Stack.Screen = ({ name, options }: { name: string; options: Opts }) => {
    mockScreens.get(mockCurrent)![name] = options
    return null
  }
  return { Stack, Redirect: () => null, useRouter: () => mockRouter, useNavigation: () => ({ getState: () => ({ index: 0, routes: [{ key: 'k' }] }), addListener: () => () => {} }), useRoute: () => ({ key: 'k' }) }
})
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: null }) }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
jest.mock('../../../components/saved/saved-list-screen', () => ({ savedTitle: () => 'Saved' }))

beforeEach(() => jest.clearAllMocks())

// The mobile tsconfig carries no node types, so fs/path come in untyped.
/* eslint-disable @typescript-eslint/no-require-imports */
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as {
  readdirSync(d: string, o: { withFileTypes: true }): Entry[]
  existsSync(p: string): boolean
}
const path = require('path') as {
  join(...p: string[]): string
  dirname(p: string): string
  basename(p: string): string
  relative(a: string, b: string): string
  sep: string
}
declare const __dirname: string
const APP = path.join(__dirname, '../../../app')

/** Every route file under app/, as its URL: groups and `index` dropped. */
function routes(dir = APP, out: Record<string, string> = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) routes(full, out)
    else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_')) {
      const url = path
        .relative(APP, full)
        .replace(/\.tsx$/, '')
        .split(path.sep)
        .filter((s: string) => !/^\(.*\)$/.test(s) && s !== 'index')
      out['/' + url.join('/')] = full
    }
  }
  return out
}
const ROUTES = routes()

/** The nearest _layout above a route file, and the route's name inside it. */
function layoutOf(file: string) {
  let dir = path.dirname(file)
  while (!fs.existsSync(path.join(dir, '_layout.tsx'))) dir = path.dirname(dir)
  return { dir, name: path.relative(dir, file).replace(/\.tsx$/, '') }
}

function screensOf(dir: string) {
  if (!mockScreens.has(dir)) {
    mockCurrent = dir
    mockScreens.set(dir, {})
    const Layout = require(path.join(dir, '_layout.tsx')).default
    render(<Layout />)
  }
  return mockScreens.get(dir)!
}

const hrefs = [...new Set(FEATURES.map((f) => f.href as string))]

describe.each(hrefs)('Home shortcut %s', (href) => {
  it('leaves a way back when it is the first screen of its stack', () => {
    const file = ROUTES[href]
    expect(file).toBeDefined()
    const { dir, name } = layoutOf(file)
    // (my) and printing sit in the root stack beside (tabs): their first screen
    // inherits that stack's back. Only a stack inside the tabs has nothing under it.
    if (!dir.includes('(tabs)')) return
    // A screen straight under (tabs) is a tab root: the bar is the way out.
    if (path.basename(dir) === '(tabs)') return expect(BAR_ROOTS.has(name)).toBe(true)
    // A stack root that is itself a bar root keeps the bar.
    if (name === 'index' && BAR_ROOTS.has(path.basename(dir))) return
    const opts = screensOf(dir)[name] ?? {}
    expect(opts.headerShown).not.toBe(false)
    const left = (opts.headerLeft ?? stackScreenOptions.headerLeft)({ canGoBack: false })
    expect(left).toBeTruthy()
  })
})

describe('BackButton with nothing behind it', () => {
  it('goes Home', () => {
    mockRouter.canGoBack.mockReturnValue(false)
    render(<BackButton />)
    fireEvent.press(screen.getByLabelText('Back'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    expect(mockRouter.back).not.toHaveBeenCalled()
  })
  it('goes back when it can', () => {
    mockRouter.canGoBack.mockReturnValue(true)
    render(<BackButton />)
    fireEvent.press(screen.getByLabelText('Back'))
    expect(mockRouter.back).toHaveBeenCalled()
  })
})
