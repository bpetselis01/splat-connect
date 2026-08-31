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

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: { container: { backgroundColor: theme.colors.primary, ...theme.shadow(4) }, text: { color: '#ffffff' } },
  accent: { container: { backgroundColor: theme.colors.apricot, ...theme.shadow(4) }, text: { color: theme.colors.ink } },
  secondary: { container: { backgroundColor: theme.colors.surface, ...theme.shadow(3) }, text: { color: theme.colors.ink } },
  // Ghost is the one flat button: no border, no shadow — a quiet text action.
  ghost: { container: { backgroundColor: 'transparent', borderWidth: 0 }, text: { color: theme.colors.primaryDeep } },
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
    borderRadius: theme.radii.sm,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  text: { fontFamily: theme.fonts.black, fontSize: theme.type.body },
})
