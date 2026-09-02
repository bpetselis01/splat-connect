// Pinned corner actions: a create button, and a ⋯ holding the navigation that
// used to sit beside it. Replaces the header CTAs on Guides and Toy Library,
// which scrolled away with the header — this stays reachable from anywhere in
// the list.
//
// The create action is the trigger, not a row inside it. It used to be the
// first item of a three-item speed dial, which put the front door of the
// authoring flow two taps and a scrim away from a contributor who opened the
// app to write a guide. `primary: true` made it apricot and first; it did not
// make it reachable. Now it is the apricot button itself and the rest fan out
// from a quieter ⋯ below it.
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
  withSpring,
} from 'react-native-reanimated'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

export type CornerMenuItem = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href: string
  /** Small Jersey-10 count pill, e.g. exchange actions waiting. */
  count?: number
  /** The create action. Rendered as the corner button itself, never in the menu. */
  primary?: boolean
}

export function CornerMenu({ label, items }: { label: string; items: CornerMenuItem[] }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const rotation = useSharedValue(0)
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }))

  const primary = items.find((i) => i.primary)
  const rest = items.filter((i) => !i.primary)
  // A count on a hidden row is a count nobody sees, so the trigger carries the
  // total — the same signal the row keeps once the menu is open.
  const hiddenCount = rest.reduce((n, i) => n + (i.count ?? 0), 0)

  const toggle = () => {
    // 135° turns the ⋯ into a close ×; the settle spring is the same physics
    // family as the My SPLAT popover, so the two menus feel related.
    rotation.value = withSpring(open ? 0 : 135, { ...theme.motion.settle })
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
          so the zone re-applies the same inset itself. Both call sites are tab
          roots with headerShown: false, which is exactly where Screen's own
          `ownHeader` inset applies — the two stay in step. */}
      <View style={[styles.zone, { top: insets.top + theme.spacing(4) }]} pointerEvents="box-none">
        {primary ? (
          <AnimatedPressable
            testID="corner-menu-primary"
            onPress={() => router.push(primary.href as never)}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            style={styles.create}
          >
            <Ionicons name={primary.icon} size={28} color={theme.colors.ink} />
          </AnimatedPressable>
        ) : null}
        {rest.length ? (
          <AnimatedPressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ expanded: open }}
            style={styles.trigger}
          >
            <Animated.View style={iconStyle}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.ink} />
            </Animated.View>
            {!open && hiddenCount ? (
              <View style={styles.triggerCount}>
                <Text style={styles.countText}>{hiddenCount}</Text>
              </View>
            ) : null}
          </AnimatedPressable>
        ) : null}
        {open ? (
          <View accessibilityViewIsModal onAccessibilityEscape={toggle} style={styles.menu}>
            {rest.map((item, i) => (
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
                  style={styles.item}
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
  create: {
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
  // Quieter than the create button on purpose: same corner, lower billing.
  trigger: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(3),
  },
  triggerCount: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    alignItems: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.mintSoft,
    paddingHorizontal: theme.spacing(1),
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
