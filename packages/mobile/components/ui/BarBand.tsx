// A screen's own pinned button band (Start building, Next) on a page the tab
// bar floats over: it sits just above the bar, and drops to the bottom edge
// when the bar tucks away. The page scrolls behind it, so the caller pads its
// scroll content by the band's reported height plus barLift.
import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'
import { barLift } from '../../lib/tab-bar-layout'
import { tabBarHidden } from '../../lib/tab-bar-visibility'

export function BarBand({
  children,
  style,
  onHeight,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onHeight?: (height: number) => void
}) {
  const insets = useSafeAreaInsets()
  const lift = barLift(insets.bottom)
  const flat = theme.spacing(3)
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift * (1 - tabBarHidden.value) }],
    paddingBottom: flat + tabBarHidden.value * (Math.max(insets.bottom, flat) - flat),
  }))
  return (
    <Animated.View
      testID="bar-band"
      style={[style, styles.band, slide]}
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
})
