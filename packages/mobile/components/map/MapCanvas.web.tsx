// packages/mobile/components/map/MapCanvas.web.tsx
// MapLibre React Native has no web build. The browser copy of the app (e2e,
// parity) gets a note instead of a map; the List view works there as on a phone.
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'
import type { MapCanvasProps } from './MapCanvas'

export function MapCanvas({ inset }: MapCanvasProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { paddingTop: inset.top, paddingBottom: inset.bottom }]}>
      <Text style={styles.text}>The map draws in the app. Tap List to see every place.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken, padding: theme.spacing(8) },
  text: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.muted, textAlign: 'center' },
})
