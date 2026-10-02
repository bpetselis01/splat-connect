// A floating glass pill with four ordinary tabs — Home, Map, Inbox, Me.
// Ours rather than react-navigation's because the pill floats over the
// content instead of spanning the screen edge to edge.
import { useEffect, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
// expo-router 57 vendors react-navigation internally rather than depending on
// the npm package, so the type comes from expo-router's own re-export.
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { theme } from '../lib/theme'
import { TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from '../lib/tab-bar-layout'

// Roots that show the bar. Guides and Toys are hidden tabs reached from Home:
// they show the bar with Home lit. Explore is a pushed place, never a root.
const BAR_ROOTS = new Set(['home', 'map', 'inbox', 'me', 'guides', 'toy-library'])
const BUTTONS = ['home', 'map', 'inbox', 'me']

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  home: { on: 'home', off: 'home-outline' },
  map: { on: 'map', off: 'map-outline' },
  inbox: { on: 'mail', off: 'mail-outline' },
  me: { on: 'person', off: 'person-outline' },
}

/**
 * A small overshoot-and-settle on the icon when its tab becomes current —
 * the visual twin of the selection haptic firing at the same moment.
 */
function SpringIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const scale = useSharedValue(1)
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.18, { ...theme.motion.press }),
        withSpring(1, { ...theme.motion.settle })
      )
    }
  }, [focused, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return <Animated.View style={style}>{children}</Animated.View>
}

/** Per-tab counts: unread on Inbox, things waiting on you on Me. */
type Props = BottomTabBarProps & { badges: Record<string, number> }

export function TabBar({ state, descriptors, navigation, insets, badges }: Props) {
  // The bar shows on tab roots only: a screen pushed on a tab's stack, and
  // Explore, go without it.
  const current = state.routes[state.index]
  const depth = (current?.state as { index?: number } | undefined)?.index ?? 0
  if (!current || !BAR_ROOTS.has(current.name) || depth > 0) return null

  const lit = BUTTONS.includes(current.name) ? current.name : 'home'
  const items = BUTTONS.flatMap((name) => state.routes.filter((r) => r.name === name))
    .map((route) => {
      const focused = route.name === lit
      const label = descriptors[route.key].options.title ?? route.name
      const icon = ICONS[route.name] ?? ICONS.home
      const badge = badges[route.name] ?? 0
      const noun = route.name === 'inbox' ? 'unread' : 'waiting'
      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
        // Not `!focused`: Home is lit on the Guides and Toys roots too, and
        // tapping it there must still go back to Home.
        if (route.key !== current.key && !event.defaultPrevented) {
          // Selection feedback, not impact: a tab change is a selection in
          // iOS's haptic grammar. Fire-and-forget — web rejects, not no-ops.
          Haptics.selectionAsync().catch(() => {})
          navigation.navigate(route.name)
        }
      }
      const tint = focused ? theme.colors.primaryDeep : theme.colors.muted
      return (
        <Pressable
          key={route.key}
          onPress={onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={badge > 0 ? `${label}, ${badge} ${noun}` : label}
          style={[styles.item, focused && styles.itemOn]}
        >
          <SpringIcon focused={focused}>
            <Ionicons name={focused ? icon.on : icon.off} size={24} color={tint} />
          </SpringIcon>
          <Text maxFontSizeMultiplier={1.3} style={[styles.label, { color: tint }]}>{label}</Text>
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(badge > 99 ? '99+' : String(badge))}</Text>
            </View>
          ) : null}
        </Pressable>
      )
    })

  // Floats over the content so a list scrolls behind the glass; tab roots
  // reserve tabBarClearance. Sits on the home indicator where there is one.
  return (
    <View testID="tab-bar" style={[styles.bar, { bottom: Math.max(insets.bottom, TAB_BAR_OFFSET) }]}>
      <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      {items}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.62)',
    ...theme.shadow(3),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: theme.radii.pill },
  itemOn: { backgroundColor: theme.colors.accentLight },
  label: { fontFamily: theme.fonts.black, fontSize: 11 },
  badge: {
    position: 'absolute', top: 6, right: 18, minWidth: 18, height: 18, paddingHorizontal: 5,
    borderRadius: theme.radii.pill, backgroundColor: theme.colors.apricot,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: 10, lineHeight: 12, color: theme.colors.ink },
})
