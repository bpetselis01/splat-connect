// packages/mobile/components/ui/StaggeredList.tsx
import { useEffect } from 'react'
import { FlatList, type FlatListProps } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { theme } from '../../lib/theme'

function StaggeredItem({ index, children }: { index: number; children: React.ReactNode }) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withDelay(index * 40, withTiming(1, { duration: theme.motion.duration }))
  }, [index, progress])
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }))
  return <Animated.View style={style}>{children}</Animated.View>
}

export function StaggeredList<T>({ renderItem, ...rest }: FlatListProps<T>) {
  return (
    <FlatList
      {...rest}
      renderItem={(info) => (renderItem ? <StaggeredItem index={info.index}>{renderItem(info)}</StaggeredItem> : null)}
    />
  )
}
