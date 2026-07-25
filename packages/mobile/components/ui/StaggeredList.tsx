// packages/mobile/components/ui/StaggeredList.tsx
import { useEffect } from 'react'
import { FlatList, type FlatListProps } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'

// Past the first screenful the stagger is invisible and only adds latency, so
// the delay is capped rather than growing with the index.
const MAX_STAGGERED = 7

function StaggeredItem({ index, children }: { index: number; children: React.ReactNode }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      Math.min(index, MAX_STAGGERED) * theme.motion.stagger,
      withTiming(1, {
        duration: theme.motion.base,
        // Exponential ease-out: fast to start, long settle. Reanimated honours
        // the system "reduce motion" setting here by default.
        easing: Easing.out(Easing.cubic),
      })
    )
  }, [index, progress])

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.98 + progress.value * 0.02 },
    ],
  }))

  return <Animated.View style={style}>{children}</Animated.View>
}

export function StaggeredList<T>({ renderItem, ...rest }: FlatListProps<T>) {
  return (
    <FlatList
      {...rest}
      renderItem={(info) =>
        renderItem ? <StaggeredItem index={info.index}>{renderItem(info)}</StaggeredItem> : null
      }
    />
  )
}
