import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { theme } from '../../lib/theme'

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable)

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  /**
   * How far the control dips on press. Big surfaces need less travel than
   * small ones — a full-width card scaling to 0.96 looks like it fell over.
   */
  pressScale?: number
}

export function AnimatedPressable({
  style,
  pressScale,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1)
  const target = pressScale ?? theme.motion.pressScale
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <ReanimatedPressable
      {...rest}
      onPressIn={(e) => {
        // Spring rather than timing: the release settles instead of stopping
        // dead, which is what makes the press read as physical.
        scale.value = withSpring(target, { ...theme.motion.press })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { ...theme.motion.press })
        onPressOut?.(e)
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </ReanimatedPressable>
  )
}
