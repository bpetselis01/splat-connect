import { View, StyleSheet } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { ScreenHeader } from '../../components/ui/ScreenHeader'
import { ToBeCompleted } from '../../components/ui/ToBeCompleted'
import { theme } from '../../lib/theme'

// PENDING(map-tab): the multi-layer map of toys, printers, events and drop-offs
// needs a maps provider, so the tab says it is to be completed.
export default function MapTab() {
  return (
    <Screen ownHeader>
      <ScreenHeader title="Map" />
      <View style={styles.body}>
        <ToBeCompleted icon="map-outline">
          The map of toys, printers, events and drop-offs near you will appear here.
        </ToBeCompleted>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: theme.spacing(4) },
})
