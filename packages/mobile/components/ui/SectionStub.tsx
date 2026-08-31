// packages/mobile/components/ui/SectionStub.tsx
// A destination that exists in the shell before its screen is built. Blurb
// only — no "coming soon", no fake steps; the next phase replaces the file,
// not this component. Title comes from the native header (app/(my)/_layout.tsx),
// so this doesn't repeat it.
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function SectionStub({ title, blurb }: { title: string; blurb: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.blurb}>{blurb}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  blurb: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
})
