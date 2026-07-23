import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { theme } from '../../lib/theme'

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable)

type AnimatedPressableProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }

export function AnimatedPressable({ style, onPressIn, onPressOut, children, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <ReanimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(theme.motion.pressScale, { duration: theme.motion.duration })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: theme.motion.duration })
        onPressOut?.(e)
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </ReanimatedPressable>
  )
}
