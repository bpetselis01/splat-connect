// packages/mobile/components/ui/Card.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { theme } from '../../lib/theme'

/**
 * `raised`  — white on the tinted canvas. The default; list rows, content.
 * `flat`    — outlined, no shadow. Grouped/settings-shaped content, where a
 *             stack of shadows would read as clutter.
 * `feature` — brand-tinted. One per screen at most, for the thing that matters.
 */
type CardVariant = 'raised' | 'flat' | 'feature'

export function Card({
  variant = 'raised',
  style,
  children,
  ...rest
}: ViewProps & { variant?: CardVariant }) {
  return (
    <View style={[styles.base, styles[variant], style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing(4),
  },
  raised: {
    backgroundColor: theme.colors.surface,
    ...theme.elevation.rest,
  },
  flat: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  feature: {
    backgroundColor: theme.colors.accentLight,
  },
})
