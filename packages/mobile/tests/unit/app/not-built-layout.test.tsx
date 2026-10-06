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
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: null }) }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ feature: 'google-sign-in' }),
}))

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
