import { Text, View, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

type ToneKey = keyof typeof theme.colors.tone
const TONE: Record<string, ToneKey> = {
  draft: 'sunken', withdrawn: 'sunken', toy_adaptation: 'sunken', assistive_tech: 'sunken',
  pending: 'honey', requested: 'honey', medium: 'honey',
  approved: 'mint', published: 'mint', completed: 'mint', graduated: 'mint', easy: 'mint', switch_adapted: 'mint',
  rejected: 'apricot', hard: 'apricot',
  accepted: 'brand', challenge: 'brand', available: 'brand',
  // maturity — 'complete' never renders a badge, absence is the signal
  concept: 'sunken', prototype: 'honey', in_progress: 'brand',
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = theme.colors.tone[TONE[status] ?? 'sunken']
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{(label ?? status).toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start',
  },
  text: { fontFamily: theme.fonts.bold, fontSize: 9, letterSpacing: 0.6 },
})
