// packages/mobile/components/ui/Button.tsx
import {
  ActivityIndicator,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: theme.colors.primary, ...theme.elevation.rest },
    text: { color: '#ffffff' },
  },
  secondary: {
    container: { backgroundColor: theme.colors.accentLight },
    text: { color: theme.colors.primaryDeep },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: theme.colors.primaryDark } },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        VARIANTS[variant].container,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={VARIANTS[variant].text.color as string} />
      ) : (
        <Text style={[styles.text, VARIANTS[variant].text]}>{label}</Text>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(4),
    paddingHorizontal: theme.spacing(6),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  text: { fontFamily: theme.fonts.bold, fontSize: theme.type.body },
})
