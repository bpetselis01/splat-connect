// packages/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ColorValue } from 'react-native'
import { theme } from '../../lib/theme'

// Outline when inactive, solid when active. That is the standard iOS and
// Material read for selection, and it costs nothing — unlike a custom
// indicator, which would fight the platform tab bar.
const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  profile: { on: 'person', off: 'person-outline' },
  scanner: { on: 'scan', off: 'scan-outline' },
  home: { on: 'home', off: 'home-outline' },
  'toy-library': { on: 'cube', off: 'cube-outline' },
  print: { on: 'print', off: 'print-outline' },
}

function tabIcon(name: keyof typeof ICONS) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? ICONS[name].on : ICONS[name].off} size={size} color={color} />
  }
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        // Colour only. Overriding height or padding here clips the label —
        // react-navigation already sizes the bar around the safe-area inset,
        // and any manual geometry fights that rather than adding to it.
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.semiBold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('profile') }} />
      <Tabs.Screen name="scanner" options={{ title: 'Scanner', tabBarIcon: tabIcon('scanner') }} />
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="toy-library" options={{ title: 'Toy Library', tabBarIcon: tabIcon('toy-library') }} />
      <Tabs.Screen name="print" options={{ title: '3D Print', tabBarIcon: tabIcon('print') }} />
    </Tabs>
  )
}
