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
    // A card is the card radius, not the field radius — the sweep off the old
    // scale mapped every md/sm onto field, which is right for controls and a
    // rung too tight here.
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    // The hairline, not ink. Soft Pop separates a card from the canvas with
    // elevation; the border is only there to hold the edge in high contrast.
    borderColor: theme.colors.border,
    padding: theme.spacing(5),
    backgroundColor: theme.colors.surface,
  },
  raised: { ...theme.shadow(2) },
  // One rung deeper and on the brand tint — the hero box on a screen.
  feature: { backgroundColor: theme.colors.accentLight, ...theme.shadow(3) },
})
