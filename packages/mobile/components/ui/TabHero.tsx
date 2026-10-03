// packages/mobile/components/ui/TabHero.tsx
//
// The board's tab-root heading: a muted greeting line over a 28px Baloo title,
// with Splat the bear on the right. The bear is a PNG rendered from the
// board's own bear() (no SVG runtime on mobile), so it is the same drawing web
// uses, not a lookalike.
import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'

const MASCOT = {
  wave: require('../../assets/mascot-wave.png'),
  hold: require('../../assets/mascot-hold.png'),
  // wizard-mascot-done: the wizard's other two poses, rendered the same way.
  think: require('../../assets/mascot-think.png'),
  party: require('../../assets/mascot-party.png'),
}

export type MascotPose = keyof typeof MASCOT

const WAVE_MS = 900
const BREATH_MS = 1600
const breathe = { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }

/** Splat waves in on first appearance, then bobs and breathes. Under the
 *  system's reduce-motion setting it is drawn still. */
export function Mascot({ pose, size }: { pose: MascotPose; size: number }) {
  const reduced = useReducedMotion()
  const rotate = useSharedValue(reduced ? 0 : -14)
  const lift = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    if (reduced) return
    const step = { duration: WAVE_MS / 4, easing: Easing.out(Easing.quad) }
    rotate.value = withSequence(withTiming(10, step), withTiming(-6, step), withTiming(3, step), withTiming(0, step))
    lift.value = withDelay(WAVE_MS, withRepeat(withSequence(withTiming(-size * 0.04, breathe), withTiming(0, breathe)), -1))
    scale.value = withDelay(WAVE_MS, withRepeat(withSequence(withTiming(1.03, breathe), withTiming(1, breathe)), -1))
  }, [reduced, rotate, lift, scale, size])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }))

  return (
    <Animated.Image
      testID="mascot"
      source={MASCOT[pose]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

export function TabHero({
  greeting,
  title,
  pose = 'wave',
}: {
  greeting: string
  title: string
  pose?: MascotPose
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Mascot pose={pose} size={76} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
    paddingTop: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
  text: { flex: 1 },
  greeting: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  title: { fontFamily: theme.fonts.display, fontSize: 28, lineHeight: 34, color: theme.colors.ink },
})
