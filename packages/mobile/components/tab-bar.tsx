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
export const BAR_ROOTS = new Set(['home', 'map', 'inbox', 'me', 'guides', 'toy-library'])
const BUTTONS = ['home', 'map', 'inbox', 'me']

// Outline always, as the board draws it: the lit tab changes colour and gets
// the pill, not a filled glyph.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  map: 'map-outline',
  inbox: 'file-tray-outline',
  me: 'person-outline',
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
  const nested = current?.state as { index?: number; routes?: { name: string }[] } | undefined
  const depth = nested?.index ?? 0
  // A screen opened into an unvisited stack is the only one in it (depth 0), so
  // the stack's root is told by name. Before the stack has reported a state at
  // all (the first screen of a stack that was unmounted) the name is only in
  // the params the tab was navigated with.
  const child = nested?.routes?.[depth]?.name ?? (current?.params as { screen?: string } | undefined)?.screen
  if (!current || !BAR_ROOTS.has(current.name) || depth > 0 || (child && child !== 'index')) return null

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
            <Ionicons name={icon} size={24} color={tint} />
          </SpringIcon>
          <Text maxFontSizeMultiplier={1.3} style={[styles.label, { color: tint }]}>{label}</Text>
          {badge > 0 ? (
            <View pointerEvents="none" style={styles.badgeAnchor}>
              <View testID="tab-badge" style={styles.badge}>
                <Text style={styles.badgeText}>{(badge > 99 ? '99+' : String(badge))}</Text>
              </View>
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
    // The board's 0 12 28 at .14; elevation 3 of the ladder is .1.
    shadowOpacity: 0.14,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: theme.radii.pill },
  // accentLight at 85%, so the glass shows through the pill.
  itemOn: { backgroundColor: 'rgba(220,240,251,0.85)' },
  label: { fontFamily: theme.fonts.black, fontSize: 11 },
  // The board puts the badge's right edge 22px right of the item's centre.
  // A flex row with 50% right padding lands on the centre; the margin does
  // the 22 (+2 for the ring, which the board draws outside the 17px box).
  badgeAnchor: { position: 'absolute', top: 3, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: '50%' },
  // dangerDeep, not the board's #e05252: white on that is 3.82:1, under AA.
  badge: {
    marginRight: -24, minWidth: 21, height: 21, paddingHorizontal: 3, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.dangerDeep, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: 10.5, lineHeight: 17, color: '#ffffff' },
})
