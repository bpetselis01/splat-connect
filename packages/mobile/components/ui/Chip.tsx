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
}: {
  label: string
  active: boolean
  onPress: () => void
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
      [theme.colors.surface, theme.colors.primary]
    ),
    borderColor: interpolateColor(
      on.value,
      [0, 1],
      [theme.colors.border, theme.colors.primary]
    ),
  }))

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [theme.colors.primaryDeep, '#ffffff']),
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={styles.chip}
    >
      <Animated.View style={[styles.fill, fill]}>
        <Animated.Text style={[styles.text, text]}>{label}</Animated.Text>
      </Animated.View>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  // 48 clears both the iOS 44pt and Android 48dp touch-target floors.
  chip: { borderRadius: theme.radii.pill, minHeight: 48, justifyContent: 'center' },
  fill: {
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: theme.fonts.bold, fontSize: theme.type.label },
})
