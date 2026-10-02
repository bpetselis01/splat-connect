import { View, Text, StyleSheet } from 'react-native'
import { PENDING } from '@splat-connect/types'
import { Screen } from '../../components/ui/Screen'
import { ScreenHeader } from '../../components/ui/ScreenHeader'
import { PendingRow } from '../../components/ui/pending'
import { theme } from '../../lib/theme'

// The map of toys, printers, events and drop-offs is sub-project 6; until then
// the tab says so and the row opens the board's Not built yet screen.
export default function MapTab() {
  return (
    <Screen ownHeader>
      <ScreenHeader title="Map" />
      <View style={styles.body}>
        <Text style={styles.blurb}>{PENDING['map-tab'].blurb}</Text>
        <PendingRow pending="map-tab" label="Open the map" icon="map-outline" />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing(4) },
  blurb: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.muted },
})
