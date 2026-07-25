// packages/mobile/components/ui/Skeleton.tsx
import { useEffect } from 'react'
import { View, StyleSheet, type DimensionValue } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'
import { Card } from './Card'

/**
 * A placeholder shaped like the content that is coming. Preferred over a
 * spinner in the middle of a list: the layout does not jump when data lands,
 * and the wait reads as "loading this" rather than "something is happening".
 */
export function Skeleton({
  width = '100%',
  height = 14,
  style,
}: {
  width?: DimensionValue
  height?: number
  style?: object
}) {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    )
  }, [pulse])

  const animated = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.4 }))

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bar, { width, height, borderRadius: height / 2 }, animated, style]}
    />
  )
}

/** The library row's loading shape — thumbnail block plus two text lines. */
export function SkeletonRow() {
  return (
    <Card style={styles.row}>
      <Skeleton width={104} height={104} style={styles.thumb} />
      <View style={styles.body}>
        <Skeleton width="72%" height={16} />
        <Skeleton width="94%" height={12} />
        <Skeleton width="55%" height={12} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  bar: { backgroundColor: theme.colors.surfaceSunken },
  row: {
    flexDirection: 'row',
    gap: theme.spacing(4),
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  thumb: { borderRadius: theme.radii.md },
  body: { flex: 1, gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
})
