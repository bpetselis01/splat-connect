// Pinned corner action menu: an apricot "Actions" pill in the bottom-right,
// fanning its items upward as pill buttons (the same pill, hairline and
// elevation as Button and the filter control). (A hamburger top-right until 2026-09-23, when the
// tab headings took the mascot and that corner.) Replaces the header CTA buttons on Guides and Toy Library, which
// scrolled away with the header — this stays reachable from anywhere in the
// list.
//
// It was a plus until 2026-09-02, on the reasoning that this is a speed dial
// rather than navigation. The contents have since drifted the other way: two of
// Guides' three items and three of Toy Library's four are places to go, not
// things to make. A plus promises "create" and then opens a menu that is mostly
// navigation, so the icon was the part that had stopped being true.
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tabBarClearance } from '../../lib/tab-bar-layout'
import { AnimatedPressable } from './AnimatedPressable'

export type CornerMenuItem = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href: string
  /** Count badge, e.g. exchange actions waiting. */
  count?: number
  /** Fill of the icon circle; accentLight when left out. */
  tint?: string
  /** The create action: apricot, first slot. */
  primary?: boolean
}

export function CornerMenu({ label, items }: { label: string; items: CornerMenuItem[] }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  // Cross-fade, not rotation. The old 135° spin worked because a plus turned
  // 135° IS an ×; three stacked lines turned 135° are three stacked lines on a
  // diagonal, which reads as broken rather than as closed. So the two glyphs
  // are stacked and their opacity is swapped instead.
  const openness = useSharedValue(0)
  const menuIcon = useAnimatedStyle(() => ({ opacity: 1 - openness.value }))
  const closeIcon = useAnimatedStyle(() => ({ opacity: openness.value }))

  const toggle = () => {
    // Timing rather than the settle spring the plus used: a spring overshoots,
    // and an opacity that overshoots just clamps — the bounce is spent where it
    // cannot be seen. The items keep the spring; they have distance to travel.
    openness.value = withTiming(open ? 0 : 1, { duration: theme.motion.fast })
    setOpen(!open)
  }
  const go = (href: string) => {
    toggle()
    router.push(href as never)
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open ? (
        <Animated.View
          entering={FadeIn.duration(theme.motion.fast)}
          exiting={FadeOut.duration(theme.motion.fast)}
          style={styles.scrim}
        >
          <Pressable
            testID="corner-menu-scrim"
            onPress={toggle}
            accessibilityLabel={`Close ${label}`}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {/* The board's grid disc, bottom-right above the tab bar: reachable
          by a thumb from anywhere in the list, and clear of the mascot the
          tab heading now carries top-right. The menu fans upward from it. */}
      <View testID="corner-menu-zone" style={[styles.zone, { bottom: tabBarClearance(insets.bottom) }]} pointerEvents="box-none">
        {open ? (
          <View accessibilityViewIsModal onAccessibilityEscape={toggle} style={styles.menu}>
            {items.map((item, i) => (
              <Animated.View
                key={item.label}
                entering={FadeInDown.delay(i * theme.motion.stagger)
                  .springify()
                  .damping(theme.motion.settle.damping)
                  .stiffness(theme.motion.settle.stiffness)
                  .mass(theme.motion.settle.mass)}
                exiting={FadeOut.duration(theme.motion.fast)}
              >
                <AnimatedPressable
                  onPress={() => go(item.href)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={[styles.item, item.primary && styles.itemPrimary]}
                >
                  {item.primary ? (
                    <Ionicons name={item.icon} size={18} color={theme.colors.ink} />
                  ) : (
                    <View style={[styles.itemIcon, { backgroundColor: item.tint ?? theme.colors.accentLight }]}>
                      <Ionicons name={item.icon} size={16} color={theme.colors.ink} />
                    </View>
                  )}
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.count ? (
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{item.count}</Text>
                    </View>
                  ) : null}
                </AnimatedPressable>
              </Animated.View>
            ))}
          </View>
        ) : null}
        <AnimatedPressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          style={styles.trigger}
        >
          <View style={styles.triggerGlyph}>
            <Animated.View style={menuIcon}>
              <Ionicons name="grid-outline" size={18} color={theme.colors.ink} />
            </Animated.View>
            {/* Absolute so the two glyphs share one box and neither shifts the
                other while they cross. */}
            <Animated.View style={[styles.triggerIcon, closeIcon]}>
              <Ionicons name="close" size={20} color={theme.colors.ink} />
            </Animated.View>
          </View>
          <Text style={styles.triggerLabel}>{open ? 'Close' : 'Actions'}</Text>
        </AnimatedPressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.scrim,
  },
  zone: {
    position: 'absolute',
    right: theme.spacing(4),
    alignItems: 'flex-end',
    gap: theme.spacing(2),
  },
  triggerGlyph: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  triggerIcon: { position: 'absolute' },
  // Button's accent variant: apricot, hairline, elevation 2, 48px pill.
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(5),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.apricot,
    ...theme.shadow(2),
  },
  triggerLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  menu: { alignItems: 'flex-end', gap: theme.spacing(2) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 44,
    paddingVertical: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(4),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  itemPrimary: { backgroundColor: theme.colors.apricot, paddingLeft: theme.spacing(4) },
  itemIcon: { width: 32, height: 32, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  // FilterControls' badge: apricot, ringed in the surface colour.
  countPill: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.apricot,
  },
  countText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.ink },
})
