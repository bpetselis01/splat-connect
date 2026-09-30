import { View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { TabBar } from '../../components/tab-bar'
import { useAuthGate } from '../../lib/use-auth-gate'
import { useCapabilities } from '../../lib/capabilities'

export default function TabsLayout() {
  const gate = useAuthGate()
  const { caps } = useCapabilities()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />

  const badges = { inbox: caps?.unread.total ?? 0, me: caps?.exchangeActions ?? 0 }
  return (
    <View style={{ flex: 1 }}>
      <Tabs tabBar={(props) => <TabBar {...props} badges={badges} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="guides" options={{ title: 'Guides' }} />
        <Tabs.Screen name="toy-library" options={{ title: 'Toys' }} />
        <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
        <Tabs.Screen name="me" options={{ title: 'Me' }} />
        {/* Explore is a card at the bottom of Me, never a tab: its screens keep
            their routes and their stack, the bar just has no button for it. */}
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </View>
  )
}
