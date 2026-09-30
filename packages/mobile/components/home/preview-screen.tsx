import { View, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function PreviewScreen({ pdfUrl }: { pdfUrl: string | null }) {
  if (!pdfUrl) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="document-outline"
          title="No PDF is available for this tutorial yet."
          hint="Contributors add the step-by-step PDF once a tutorial is approved."
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <WebView source={{ uri: pdfUrl }} style={styles.webview} />
      {/*
        The in-app viewer cannot print, share or zoom the way the system
        viewer can, so the handoff stays visible rather than hiding behind a
        failure state.
      */}
      <View style={styles.footer}>
        <Button label="Open in Browser" onPress={() => Linking.openURL(pdfUrl)} variant="secondary" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background },
  footer: {
    padding: theme.spacing(4),
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
})
