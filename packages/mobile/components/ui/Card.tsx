// packages/mobile/components/ui/Card.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { theme } from '../../lib/theme'

/**
 * `raised`  — white on the tinted canvas. The default; list rows, content.
 * `feature` — brand-tinted. One per screen at most, for the thing that matters.
 */
type CardVariant = 'raised' | 'feature'

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
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    padding: theme.spacing(4),
    backgroundColor: theme.colors.surface,
  },
  raised: { ...theme.shadow(4) },
  // Feature cards sit one rung deeper and on the brand tint — the hero box on a screen.
  feature: { backgroundColor: theme.colors.accentLight, borderWidth: theme.border.thick, ...theme.shadow(5) },
})
