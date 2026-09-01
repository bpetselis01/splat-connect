// The quiet regulatory disclaimer — mobile twin of web's
// components/not-medical-note.tsx (see /legal/intended-purpose there).
// Rendered wherever a child profile is edited and wherever suggested guides
// are shown. Understated on purpose — honest context, not a warning banner.
import { Text, Linking, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function NotMedicalNote() {
  return (
    <Text style={styles.note}>
      Suggestions are for toys and everyday aids only. SPLAT Connect is not a medical
      device and does not replace advice from your child&apos;s therapist or doctor.{' '}
      <Text
        style={styles.link}
        onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/legal/intended-purpose`)}
      >
        Read more
      </Text>
    </Text>
  )
}

const styles = StyleSheet.create({
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: theme.spacing(4),
  },
  link: { textDecorationLine: 'underline' },
})
