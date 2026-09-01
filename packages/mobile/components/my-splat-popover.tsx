// Grows out of the centre button and leaves the tab bar live: the scrim stops
// at the bar's top edge, so a tap on any tab closes this (the layout listens
// for tabPress) and navigates in one gesture.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'
import type { Capabilities } from '@splat-connect/types'
import { theme } from '../lib/theme'
import { popoverTiles } from '../lib/my-splat-tiles'
import { myRoute } from '../lib/my-routes'

export function MySplatPopover({ caps, tabBarHeight, onClose }: { caps: Capabilities; tabBarHeight: number; onClose: () => void }) {
  const router = useRouter()
  const go = (href: string) => { onClose(); router.push(href as never) }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(theme.motion.fast)}
        exiting={FadeOut.duration(theme.motion.fast)}
        style={[styles.scrim, { bottom: tabBarHeight }]}
      >
        <Pressable testID="my-splat-scrim" onPress={onClose} accessibilityLabel="Close My SPLAT" style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* springify so the panel settles like everything else that moves here
          (same physics family as theme.motion.settle); the exit matters more —
          without it the panel vanished in one frame while the scrim it rode in
          with was still fading. */}
      <Animated.View
        entering={ZoomIn.springify().damping(16).stiffness(170).mass(0.9)}
        exiting={ZoomOut.duration(theme.motion.fast)}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        style={[styles.panel, { bottom: tabBarHeight + 30 }]}
      >
        <View style={styles.head}>
          <Text style={styles.title}>MY SPLAT</Text>
          <Text style={styles.hint}>Hi, {caps.profile.name.split(' ')[0]}</Text>
        </View>
        <View style={styles.grid}>
          {popoverTiles(caps).map((t) => (
            <Pressable key={t.label} onPress={() => go(myRoute(t.href))} accessibilityRole="button" accessibilityLabel={t.label} style={styles.tile}>
              <Ionicons name={t.icon} size={20} color={theme.colors.ink} />
              <Text style={styles.tileLabel}>{t.label}</Text>
              {t.count ? <View style={styles.badge}><Text style={styles.badgeText}>{String(t.count)}</Text></View> : null}
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => go('/my-splat')} accessibilityRole="button" accessibilityLabel="All of My SPLAT" style={styles.all}>
          <View>
            <Text style={styles.allLabel}>All of My SPLAT</Text>
            <Text style={styles.allHint}>Challenges · Organisation · Print requests · Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.tail} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(10,53,80,0.45)' },
  panel: {
    position: 'absolute', left: 12, right: 12,
    backgroundColor: theme.colors.background,
    borderWidth: theme.border.thick, borderColor: theme.colors.ink, borderRadius: theme.radii.lg + 2,
    padding: 12, gap: 10, ...theme.shadow(6),
  },
  tail: {
    position: 'absolute', alignSelf: 'center', bottom: -12, width: 18, height: 18,
    backgroundColor: theme.colors.background,
    borderRightWidth: theme.border.thick, borderBottomWidth: theme.border.thick, borderColor: theme.colors.ink,
    transform: [{ rotate: '45deg' }],
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: theme.fonts.black, fontSize: 15, letterSpacing: 0.6, color: theme.colors.ink },
  hint: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48%', minHeight: 60, gap: 4, padding: 9,
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, ...theme.shadow(3),
  },
  tileLabel: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.ink },
  badge: {
    position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10,
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, backgroundColor: theme.colors.apricot,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.numeral, fontSize: 15, lineHeight: 16, color: theme.colors.ink },
  all: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10,
    borderWidth: theme.border.thin, borderStyle: 'dashed', borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, backgroundColor: theme.colors.accentLight,
  },
  allLabel: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.ink },
  allHint: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted },
})
