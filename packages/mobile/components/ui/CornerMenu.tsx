// Pinned corner action menu: a hamburger in the top-right that fans its items
// downward. Replaces the header CTA buttons on Guides and Toy Library, which
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { AnimatedPressable } from './AnimatedPressable'

export type CornerMenuItem = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href: string
  /** Small Jersey-10 count pill, e.g. exchange actions waiting. */
  count?: number
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
      {/* Screen pads for the notch, but absolute positioning ignores padding,
          so the zone re-applies the same inset itself. */}
      <View style={[styles.zone, { top: insets.top + theme.spacing(4) }]} pointerEvents="box-none">
        <AnimatedPressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          style={styles.trigger}
        >
          <Animated.View style={menuIcon}>
            <Ionicons name="menu" size={26} color={theme.colors.ink} />
          </Animated.View>
          {/* Absolute so the two glyphs share one box and neither shifts the
              other while they cross. */}
          <Animated.View style={[styles.triggerIcon, closeIcon]}>
            <Ionicons name="close" size={26} color={theme.colors.ink} />
          </Animated.View>
        </AnimatedPressable>
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
                  <Ionicons name={item.icon} size={16} color={theme.colors.ink} />
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
    backgroundColor: 'rgba(18, 40, 58, 0.28)',
  },
  zone: {
    position: 'absolute',
    right: theme.spacing(4),
    alignItems: 'flex-end',
    gap: theme.spacing(2),
  },
  triggerIcon: { position: 'absolute' },
  trigger: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(4),
  },
  menu: { alignItems: 'flex-end', gap: theme.spacing(2) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 44,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(4),
  },
  itemPrimary: { backgroundColor: theme.colors.apricot },
  itemLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
  },
  countPill: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.mintSoft,
    paddingHorizontal: theme.spacing(1),
  },
  countText: {
    fontFamily: theme.fonts.numeral,
    fontSize: 17,
    color: theme.colors.mintDeep,
  },
})
