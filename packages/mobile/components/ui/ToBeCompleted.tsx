// packages/mobile/components/ui/ToBeCompleted.tsx
//
// A screen or block that waits on something only the owner can supply (a maps
// provider, names, pictures). One treatment everywhere so a half-built feature
// never shows through. Items live in packages/types/src/pending.ts.
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export function ToBeCompleted({
  subject,
  children,
  compact,
  icon = 'hourglass-outline',
}: {
  /** What is missing, when the surrounding screen does not already say. */
  subject?: string
  /** The one line: what will appear here. */
  children: React.ReactNode
  /** A card inside a screen instead of standing in for it. */
  compact?: boolean
  icon?: React.ComponentProps<typeof Ionicons>['name']
}) {
  return (
    <View style={[styles.box, compact ? styles.compact : styles.full]}>
      <Ionicons name={icon} size={compact ? 22 : 36} color={theme.colors.muted} />
      <Text style={styles.pill} maxFontSizeMultiplier={1.4}>
        To be completed
      </Text>
      {subject ? <Text style={styles.subject}>{subject}</Text> : null}
      <Text style={styles.line}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: theme.spacing(2),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  full: { marginTop: theme.spacing(6), paddingVertical: theme.spacing(10), paddingHorizontal: theme.spacing(6) },
  compact: { paddingVertical: theme.spacing(4), paddingHorizontal: theme.spacing(4) },
  pill: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  subject: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.ink, textAlign: 'center' },
  line: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.muted, textAlign: 'center' },
})
