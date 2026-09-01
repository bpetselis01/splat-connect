// packages/mobile/components/ui/Chip.tsx
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

export function Chip({
  label,
  active,
  onPress,
  role = 'button',
}: {
  label: string
  active: boolean
  onPress: () => void
  /**
   * 'radio' for a chip that is one option in a single-select row wrapped in
   * an accessibilityRole="radiogroup" View (the exchange-toy chooser in
   * request-block.tsx is the existing precedent for that pairing). Defaults
   * to 'button' — most Chip rows here are independent filter toggles, not a
   * mutually exclusive choice, so 'radio' has to be opted into per call site
   * rather than assumed.
   */
  role?: 'button' | 'radio'
}) {
  // Selection crossfades instead of cutting. The fill and the label are driven
  // by the same value so they can never disagree mid-transition.
  const on = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: theme.motion.fast })
  }, [active, on])

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [theme.colors.surface, theme.colors.ink]
    ),
    // The border no longer changes with selection — always ink.
    borderColor: interpolateColor(on.value, [0, 1], [theme.colors.ink, theme.colors.ink]),
  }))

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [theme.colors.ink, theme.colors.background]),
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.chip}
    >
      <Animated.View style={[styles.fill, fill]}>
        <Animated.Text style={[styles.text, text]}>{label}</Animated.Text>
      </Animated.View>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  // 40px visual height, under the 44px touch floor — hitSlop above and below
  // restores the floor invisibly instead of growing the filter row.
  chip: { borderRadius: theme.radii.pill, minHeight: 40, justifyContent: 'center' },
  fill: {
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.thin,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: theme.fonts.bold, fontSize: theme.type.label },
})
