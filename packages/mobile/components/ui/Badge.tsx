import { Text, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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

export function Badge({
  status,
  label,
  icon,
  bg,
}: {
  status: string
  label?: string
  /** A leading glyph, as the board's row-card pills carry. */
  icon?: React.ComponentProps<typeof Ionicons>['name']
  /** Overrides the status tone's fill — the board tints some pills off-scale. */
  bg?: string
}) {
  const tone = theme.colors.tone[TONE[status] ?? 'sunken']
  // Sentence case, like the board's "Needs you": a status key becomes words.
  const raw = label ?? status.replace(/_/g, ' ')
  const text = raw.charAt(0).toUpperCase() + raw.slice(1)
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? tone.bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={tone.fg} /> : null}
      <Text style={[styles.text, { color: tone.fg }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // A tinted pill in sentence case, no border: the board's status pill.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontFamily: theme.fonts.black, fontSize: 11 },
})
