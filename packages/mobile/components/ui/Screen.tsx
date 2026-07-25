// packages/mobile/components/ui/Screen.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'

/**
 * Root container for a screen that draws its own header instead of a native
 * one. The top inset is not decoration: on a device with a Dynamic Island or
 * notch, content at y=0 sits underneath the cutout. The native stack header
 * used to supply this padding implicitly, so any screen that hides it has to
 * apply the inset itself.
 */
export function Screen({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing(4) }, style]} {...rest}>
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
