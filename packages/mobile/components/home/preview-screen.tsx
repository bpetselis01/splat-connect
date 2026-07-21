// packages/mobile/components/home/preview-screen.tsx
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'

export function PreviewScreen({ pdfUrl }: { pdfUrl: string | null }) {
  if (!pdfUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No PDF is available for this tutorial yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <WebView source={{ uri: pdfUrl }} style={styles.webview} />
      <Pressable style={styles.fallbackButton} onPress={() => Linking.openURL(pdfUrl)}>
        <Text style={styles.fallbackButtonText}>Open in Browser</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(4) },
  message: { fontFamily: theme.fonts.regular, color: theme.colors.text, textAlign: 'center' },
  fallbackButton: { padding: theme.spacing(3), alignItems: 'center', backgroundColor: theme.colors.accentLight },
  fallbackButtonText: { color: theme.colors.primaryDark, fontFamily: theme.fonts.semiBold },
})
