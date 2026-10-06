// A floating glass pill with four ordinary tabs — Home, Map, Inbox, Me.
// Ours rather than react-navigation's because the pill floats over the
// content instead of spanning the screen edge to edge, and because it lives in
// the root layout so pushed screens (My, printing) can show it too.
import { useEffect, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import { usePathname, useRouter, useSegments } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { theme } from '../lib/theme'
import { TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from '../lib/tab-bar-layout'
import { tabBarFor, type BarTab } from '../lib/tab-bar-routes'
import { setTabBarHidden, tabBarHidden } from '../lib/tab-bar-visibility'
import { useAuth } from '../lib/auth-context'
import { useCapabilities } from '../lib/capabilities'

// Outline always, as the board draws it: the lit tab changes colour and gets
// the pill, not a filled glyph.
const ICONS: Record<BarTab, keyof typeof Ionicons.glyphMap> = {
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

const TABS: { name: BarTab; label: string }[] = [
  { name: 'home', label: 'Home' },
  { name: 'map', label: 'Map' },
  { name: 'inbox', label: 'Inbox' },
  { name: 'me', label: 'Me' },
]

/**
 * The app-wide bar: it floats over every signed-in screen the route table says
 * should have it, and tucks away as a reading page scrolls down.
 */
export function TabBar() {
  const { session } = useAuth()
  const { caps } = useCapabilities()
  const router = useRouter()
  const segments = useSegments()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const rest = Math.max(insets.bottom, TAB_BAR_OFFSET)

  // A new screen starts with the bar out.
  useEffect(() => setTabBarHidden(false), [pathname])
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarHidden.value * (TAB_BAR_HEIGHT + rest + theme.spacing(3)) }],
  }))

  const { show, lit } = tabBarFor(segments)
  if (!session || !show) return null

  const badges: Record<string, number> = { inbox: caps?.unread?.total ?? 0, me: caps?.exchangeActions ?? 0 }
  const items = TABS.map(({ name, label }) => {
    const focused = name === lit
    const icon = ICONS[name]
    const badge = badges[name] ?? 0
    const noun = name === 'inbox' ? 'unread' : 'waiting'
    const onPress = () => {
      // Selection feedback, not impact: a tab change is a selection in iOS's
      // haptic grammar. Fire-and-forget — web rejects, not no-ops.
      Haptics.selectionAsync().catch(() => {})
      // navigate, not push: it unwinds to the tab's root, even from deep in a
      // stack, or off a screen pushed over the tabs.
      router.navigate(`/${name}`)
    }
    const tint = focused ? theme.colors.primaryDeep : theme.colors.muted
    return (
      <Pressable
        key={name}
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

  // Floats over the content so a list scrolls behind the glass; screens
  // reserve tabBarClearance. Sits on the home indicator where there is one.
  return (
    <Animated.View testID="tab-bar" style={[styles.bar, { bottom: rest }, slide]}>
      <BlurView intensity={60} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      {items}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    zIndex: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: theme.colors.tabGlass,
    ...theme.shadow(3),
    // The board's 0 12 28 at .14; elevation 3 of the ladder is .1.
    shadowOpacity: 0.14,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: theme.radii.pill },
  // accentLight at 85%, so the glass shows through the pill.
  itemOn: { backgroundColor: theme.colors.tabOn },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.micro },
  // The board puts the badge's right edge 22px right of the item's centre.
  // A flex row with 50% right padding lands on the centre; the margin does
  // the 22 (+2 for the ring, which the board draws outside the 17px box).
  badgeAnchor: { position: 'absolute', top: 3, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: '50%' },
  // dangerDeep, not the board's #e05252: white on that is 3.82:1, under AA.
  badge: {
    marginRight: -24, minWidth: 21, height: 21, paddingHorizontal: 3, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.dangerDeep, borderWidth: 2, borderColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, lineHeight: 17, color: theme.colors.onColor },
})
