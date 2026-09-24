// packages/mobile/components/ui/TabHero.tsx
//
// The board's tab-root heading: a muted greeting line over a 28px Baloo title,
// with Splat the bear on the right. The bear is a PNG rendered from the
// board's own bear() (no SVG runtime on mobile), so it is the same drawing web
// uses, not a lookalike.
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

const MASCOT = {
  wave: require('../../assets/mascot-wave.png'),
  hold: require('../../assets/mascot-hold.png'),
}

export type MascotPose = keyof typeof MASCOT

export function Mascot({ pose, size }: { pose: MascotPose; size: number }) {
  return (
    <Image
      source={MASCOT[pose]}
      style={{ width: size, height: size }}
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
