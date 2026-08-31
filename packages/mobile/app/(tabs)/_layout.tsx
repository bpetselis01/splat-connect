import { useState } from 'react'
import { View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PixelTabBar, TAB_BAR_HEIGHT } from '../../components/pixel-tab-bar'
import { MySplatPopover } from '../../components/my-splat-popover'
import { useAuth } from '../../lib/auth-context'
import { useCapabilities } from '../../lib/capabilities'

export default function TabsLayout() {
  const { session, loading } = useAuth()
  const { caps } = useCapabilities()
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const badge = (caps?.unread.total ?? 0) + (caps?.exchangeActions ?? 0)
  if (loading) return null
  if (!session) return <Redirect href="/sign-in" />

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (
          <PixelTabBar {...props} badge={badge} centreOpen={open} onCentrePress={() => setOpen((v) => !v)} />
        )}
        screenOptions={{ headerShown: false }}
        screenListeners={{ tabPress: () => setOpen(false) }}
      >
        <Tabs.Screen name="guides" options={{ title: 'Guides' }} />
        <Tabs.Screen name="toy-library" options={{ title: 'Toy Library' }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
        <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      </Tabs>
      {open && caps ? (
        <MySplatPopover caps={caps} tabBarHeight={TAB_BAR_HEIGHT + insets.bottom} onClose={() => setOpen(false)} />
      ) : null}
    </View>
  )
}
