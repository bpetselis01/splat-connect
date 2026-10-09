import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { webGuideUrl } from '../../lib/guide-files'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

/**
 * A guide's PDF (spec 2026-10-06 round 2): the pages on a sunken ground.
 * Downloads live on the website; the footer links to the guide's page there.
 */
export function PreviewScreen({ pdfUrl, tutorialId }: { pdfUrl: string | null; tutorialId: string }) {
  const bottom = useBottomClearance()
  if (!pdfUrl) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="document-outline"
          title="No PDF is available for this tutorial yet."
          hint="This guide has no PDF. Its steps are on the guide page."
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
      {webGuideUrl(tutorialId) ? (
        <View testID="preview-footer" style={[styles.footer, { paddingBottom: bottom }]}>
          <Button label="Download on the web" variant="secondary" onPress={() => void Linking.openURL(webGuideUrl(tutorialId)!)} style={styles.open} />
        </View>
      ) : null}
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
    paddingTop: theme.spacing(3),
    backgroundColor: theme.colors.surface,
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
  },
  open: { minHeight: 56 },
})
