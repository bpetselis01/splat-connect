// packages/mobile/tests/unit/app/not-built-layout.test.tsx
// Jest has no text layout, so real frames are checked on the simulator. This
// pins what keeps those frames apart: a flow column inside a ScrollView that
// clears both safe-area insets, and text that cannot outgrow a 320pt screen.
import { ScrollView, StyleSheet, type ViewStyle } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import NotBuilt from '../../../app/not-built'

const INSETS = { top: 59, bottom: 34, left: 0, right: 0 }
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => INSETS,
}))
const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), navigate: mockNavigate }),
  useLocalSearchParams: () => ({ feature: 'google-sign-in' }),
}))
// Signed out unless a test says otherwise: the screen opens before sign-in too.
let mockSession: { user: { id: string } } | null = null
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))

const flat = (style: unknown) => (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle

describe('Not built yet layout', () => {
  beforeEach(() => render(<NotBuilt />))

  it('scrolls, and clears the notch and the home indicator', () => {
    const scroll = screen.UNSAFE_getByType(ScrollView)
    expect(Number(flat(scroll.parent?.props.style).paddingTop)).toBeGreaterThanOrEqual(INSETS.top)
    expect(Number(flat(scroll.props.contentContainerStyle).paddingBottom)).toBeGreaterThanOrEqual(INSETS.bottom)
  })

  it('stacks tile, pill, heading, lede and button in flow, never overlaid', () => {
    const column = screen.getByText('Not built yet').parent!.parent!
    const kids = column.children.filter((c) => typeof c !== 'string')
    expect(kids).toHaveLength(6)
    for (const kid of kids) {
      const host = typeof kid.type === 'string' ? kid : kid.findAll((n) => typeof n.type === 'string')[0]
      const s = flat(host.props.style)
      expect(s.position).not.toBe('absolute')
      for (const m of [s.margin, s.marginTop, s.marginBottom, s.marginVertical]) {
        expect(Number(m ?? 0)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('caps how far the pill and heading grow with large text', () => {
    for (const el of [screen.getByText('Not built yet'), screen.getByRole('header')]) {
      expect(el.props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(1)
      expect(el.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.6)
    }
  })
})

describe('Not built yet, signed in', () => {
  afterEach(() => { mockSession = null })

  it('offers Home beside Go back once signed in, and goes there', () => {
    mockSession = { user: { id: 'me' } }
    render(<NotBuilt />)
    const home = screen.getByTestId('not-built-home')
    expect(home).toBeTruthy()
    const { fireEvent } = jest.requireActual('@testing-library/react-native')
    fireEvent.press(home)
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('shows no Home before sign-in', () => {
    render(<NotBuilt />)
    expect(screen.queryByTestId('not-built-home')).toBeNull()
  })
})
