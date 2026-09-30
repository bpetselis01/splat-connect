// packages/mobile/components/ui/ErrorRow.tsx
// A form's one-line failure: icon plus words on the apricot tint. Lived in the
// old auth-screen until that was replaced; every form in the app uses it.
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export function ErrorRow({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
      <Text style={styles.error}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.apricotSoft,
    borderRadius: theme.radii.field,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  error: {
    flex: 1,
    color: theme.colors.danger,
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    lineHeight: 18,
  },
})
