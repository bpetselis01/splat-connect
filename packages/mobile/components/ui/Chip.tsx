// packages/mobile/components/ui/Chip.tsx
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
  icon,
  variant = 'solid',
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
  /** A leading glyph in brand blue — the board's filter chips carry one. */
  icon?: React.ComponentProps<typeof Ionicons>['name']
  /**
   * 'solid' (default) fills brand on select. 'filter' is the board's 44px
   * filter chip: white, and selected is the brand tint with a brand edge, so
   * a row of several on at once still reads as quiet.
   */
  variant?: 'solid' | 'filter'
}) {
  const filter = variant === 'filter'
  const offBg = theme.colors.surface
  const onBg = filter ? theme.colors.accentLight : theme.colors.primaryDark
  const onEdge = filter ? theme.colors.primary : theme.colors.primaryDark
  const onInk = filter ? theme.colors.ink : theme.colors.surface
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
      [offBg, onBg]
    ),
    // The hairline stays; a selected chip is a brand fill, not an ink one.
    borderColor: interpolateColor(on.value, [0, 1], [theme.colors.border, onEdge]),
  }))

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [theme.colors.ink, onInk]),
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, filter && styles.filterChip]}
    >
      <Animated.View style={[styles.fill, filter && styles.filterFill, fill]}>
        {icon ? <Ionicons name={icon} size={15} color={theme.colors.primaryDark} /> : null}
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
    borderWidth: theme.border.hairline,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: { minHeight: 44 },
  filterFill: { minHeight: 44, ...theme.shadow(1) },
  text: { fontFamily: theme.fonts.bold, fontSize: theme.type.label },
})
