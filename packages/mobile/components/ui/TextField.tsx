// packages/mobile/components/ui/TextField.tsx
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
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
  icon,
  boxStyle,
  boxTestID,
  style,
  ...input
}: TextInputProps & {
  label?: string
  hint?: string
  /** Renders inside the focus ring, ahead of the input. */
  icon?: React.ComponentProps<typeof Ionicons>['name']
  /** Overrides on the bordered box itself — a pill radius, extra padding. */
  boxStyle?: StyleProp<ViewStyle>
  /** testID for the bordered box, not the inner TextInput. */
  boxTestID?: string
}) {
  const focus = useSharedValue(0)

  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.ink, theme.colors.primary]
    ),
  }))

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Animated.View
        testID={boxTestID}
        style={[styles.box, icon ? styles.boxRow : null, boxStyle, ring]}
      >
        {icon ? (
          <Ionicons name={icon} size={19} color={theme.colors.muted} style={styles.icon} />
        ) : null}
        <TextInput
          {...input}
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
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
    borderWidth: theme.border.thin,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
  },
  boxRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: theme.spacing(2) },
  inputWithIcon: { flex: 1, paddingHorizontal: 0 },
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
