// packages/mobile/components/ui/Screen.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'

/**
 * Root container for any screen in the app.
 *
 * `ownHeader` is about the notch, and it is opt-in because most screens do not
 * need it. A native stack header has already cleared the Dynamic Island by the
 * time it renders its content, so a screen sitting under one must NOT add the
 * top inset again — it did until 2026-09-02, and every screen behind a header
 * opened with insets.top + 16 (63px on an iPhone 13) of dead space where 16 was
 * meant. It cost nothing in Playwright, where insets.top is 0, which is why it
 * survived a redesign that was itself driven by web-driven screenshots.
 *
 * So: pass `ownHeader` only on a screen whose route sets `headerShown: false`
 * and which therefore draws its own ScreenHeader — the four tab roots and the
 * auth gate. Everything else leaves it off.
 */
export function Screen({
  ownHeader = false,
  style,
  children,
  ...rest
}: ViewProps & { ownHeader?: boolean }) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: (ownHeader ? insets.top : 0) + theme.spacing(4) },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing(4),
  },
})
