// react-navigation's bar can't raise one item above the shelf, so the bar is
// ours: four ordinary items, and in the middle a disc that is a button, not a
// tab — it opens the MY SPLAT popover (Task 7) and never navigates.
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
// expo-router 57 vendors react-navigation internally rather than depending on
// the npm package, so the type comes from expo-router's own re-export.
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../lib/theme'

export const TAB_BAR_HEIGHT = 64

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  guides: { on: 'book', off: 'book-outline' },
  'toy-library': { on: 'cube', off: 'cube-outline' },
  explore: { on: 'compass', off: 'compass-outline' },
  inbox: { on: 'mail', off: 'mail-outline' },
}

type Props = BottomTabBarProps & { badge: number; centreOpen: boolean; onCentrePress: () => void }

export function PixelTabBar({ state, descriptors, navigation, insets, badge, centreOpen, onCentrePress }: Props) {
  const items = state.routes.map((route, index) => {
    const focused = state.index === index
    const label = descriptors[route.key].options.title ?? route.name
    const icon = ICONS[route.name] ?? ICONS.guides
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
    }
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={route.name === 'inbox' && badge > 0 ? `${label}, ${badge} unread` : label}
        style={styles.item}
      >
        <View>
          <Ionicons name={focused ? icon.on : icon.off} size={22} color={focused ? theme.colors.ink : theme.colors.muted} />
          {route.name === 'inbox' && badge > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{String(badge)}</Text></View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
      </Pressable>
    )
  })

  const centre = (
    <Pressable
      key="my-splat"
      testID="my-splat-button"
      onPress={onCentrePress}
      accessibilityRole="button"
      accessibilityLabel="Open My SPLAT"
      accessibilityState={{ expanded: centreOpen }}
      style={styles.centre}
    >
      <View style={[styles.disc, centreOpen && styles.discOpen]}>
        {/* assets/splat-logo.png is a full-colour gradient app icon with no
            alpha channel, not a silhouette — tintColor would flatten the whole
            square into one flat block instead of tinting a mark. Rendered
            untinted on a light disc face instead so it stays legible open or
            closed. */}
        <Image source={require('../assets/splat-logo.png')} style={styles.discImage} resizeMode="contain" />
      </View>
      <Text style={[styles.label, styles.centreLabel]}>MY SPLAT</Text>
    </Pressable>
  )

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {items.slice(0, 2)}{centre}{items.slice(2)}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: theme.border.thick,
    borderTopColor: theme.colors.ink,
    paddingTop: theme.spacing(2),
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 2 },
  label: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.muted },
  labelOn: { color: theme.colors.ink },
  centre: { flex: 1.25, alignItems: 'center', marginTop: -22 },
  centreLabel: { color: theme.colors.ink, letterSpacing: 0.6, marginTop: 4 },
  disc: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: theme.border.thick, borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center',
    ...theme.shadow(4),
  },
  discImage: { width: 30, height: 30 },
  // Open = pressed: apricot, shifted onto its own shadow.
  discOpen: { backgroundColor: theme.colors.apricot, transform: [{ translateX: 4 }, { translateY: 4 }], shadowOpacity: 0, elevation: 0 },
  badge: {
    position: 'absolute', top: -7, right: -10, minWidth: 20, height: 20, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    backgroundColor: theme.colors.apricot, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.numeral, fontSize: 15, lineHeight: 16, color: theme.colors.ink },
})
