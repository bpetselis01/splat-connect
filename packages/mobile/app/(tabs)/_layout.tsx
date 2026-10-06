import { View } from 'react-native'
import { theme } from '../../lib/theme'
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
      <Tabs
        tabBar={(props) => <TabBar {...props} badges={badges} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.background } }}
        // Back from a screen opened into a hidden tab returns to the tab that
        // opened it, not to the first tab.
        backBehavior="history"
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="map" options={{ title: 'Map' }} />
        <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
        <Tabs.Screen name="me" options={{ title: 'Me' }} />
        {/* Hidden tabs keep their routes, stacks and deep links; Home links to
            them and the bar highlights Home while one of their roots shows. */}
        <Tabs.Screen name="guides" options={{ href: null }} />
        <Tabs.Screen name="toy-library" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </View>
  )
}
