import { ScrollView, StyleSheet } from 'react-native'
import type { screen } from '@testing-library/react-native'
import { theme } from '../../lib/theme'

/** The inset the bottom-spacing tests mock: an iPhone with a home indicator. */
export const INSET = 34
/** What a bottom band or the end of scroll content must clear on a screen without the tab bar. */
export const CLEARANCE = INSET + theme.spacing(3)

type Styled = { props: { style?: unknown; contentContainerStyle?: unknown } }

/** The paddingBottom a rendered node ends up with, whatever style shape it was given. */
export const paddingBottomOf = (node: Styled, key: 'style' | 'contentContainerStyle' = 'style') =>
  (StyleSheet.flatten(node.props[key] as object) as { paddingBottom?: number } | undefined)?.paddingBottom

/** The bottom padding of every ScrollView's content in the rendered tree. */
export const scrollPaddings = (root: typeof screen) =>
  root.UNSAFE_getAllByType(ScrollView).map((n) => paddingBottomOf(n, 'contentContainerStyle'))

/** Mock for react-native-safe-area-context with a 34 bottom inset (use inside jest.mock). */
export const insetMock = () => ({
  ...require('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
})
