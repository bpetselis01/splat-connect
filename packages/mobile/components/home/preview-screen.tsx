import { View, Text, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'

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
      <Button label="Open in Browser" onPress={() => Linking.openURL(pdfUrl)} variant="secondary" style={styles.fallbackButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(4) },
  message: { fontFamily: theme.fonts.regular, color: theme.colors.text, textAlign: 'center' },
  fallbackButton: { margin: theme.spacing(3) },
})
