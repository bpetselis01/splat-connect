// packages/mobile/components/ui/TextField.tsx
import { View, Text, TextInput, StyleSheet, type TextInputProps, type TextStyle } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'

// react-native-web paints the browser's default focus ring on top of ours: a
// square outline that ignores the border radius. The animated border below is
// the focus indicator, so this suppresses a duplicate, not the only one.
const noWebOutline = { outlineStyle: 'none' } as unknown as TextStyle

/**
 * `placeholder`, `defaultValue` and `accessibilityLabel` pass straight through
 * — the test suite queries these inputs by placeholder text.
 */
export function TextField({
  label,
  hint,
  style,
  ...input
}: TextInputProps & { label?: string; hint?: string }) {
  const focus = useSharedValue(0)

  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.border, theme.colors.primary]
    ),
  }))

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Animated.View style={[styles.box, ring]}>
        <TextInput
          {...input}
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.muted}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: theme.motion.fast })
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: theme.motion.fast })
            input.onBlur?.(e)
          }}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: theme.spacing(4) },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing(2),
  },
  box: {
    borderWidth: 1.5,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  input: {
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    minHeight: 48,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.text,
    ...noWebOutline,
  },
})
