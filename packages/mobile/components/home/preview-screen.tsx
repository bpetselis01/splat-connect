import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

/**
 * A guide's PDF (spec 2026-10-06 round 2): the pages on a sunken ground, and
 * Open in browser pinned below — the system viewer is where it prints, shares
 * and zooms, which the in-app viewer cannot.
 */
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
      <WebView
        source={{ uri: pdfUrl }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button label="Open in browser" onPress={() => Linking.openURL(pdfUrl)} style={styles.open} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSunken },
  webview: { flex: 1, backgroundColor: theme.colors.surfaceSunken },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  center: { flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background },
  footer: {
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    backgroundColor: theme.colors.surface,
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
  },
  open: { minHeight: 56 },
})
