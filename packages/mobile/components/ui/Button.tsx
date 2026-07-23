// packages/mobile/components/ui/Button.tsx
import { Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: { container: { backgroundColor: theme.colors.primary }, text: { color: '#ffffff' } },
  secondary: { container: { backgroundColor: theme.colors.accentLight }, text: { color: theme.colors.primaryDark } },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: theme.colors.primary } },
}

export function Button({ label, onPress, variant = 'primary', style }: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  style?: StyleProp<ViewStyle>
}) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.base, VARIANTS[variant].container, style]}
    >
      <Text style={[styles.text, VARIANTS[variant].text]}>{label}</Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: theme.fonts.semiBold, fontSize: 16 },
})
