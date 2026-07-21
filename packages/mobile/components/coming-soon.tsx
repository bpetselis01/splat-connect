// packages/mobile/components/coming-soon.tsx
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../lib/theme'

export function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label} is coming soon.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  text: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
})
