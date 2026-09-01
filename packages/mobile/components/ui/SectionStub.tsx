// packages/mobile/components/ui/SectionStub.tsx
// A destination that exists in the shell before its screen is built. Blurb
// only — no fake steps; the next phase replaces the file, not this component.
// Title comes from the native header, so this doesn't repeat it.
//
// `soon` upgrades the plain blurb to the spec's promised-feature treatment:
// one dimmed card carrying the promise and a SOON badge — for destinations
// that are a product promise (print requests, print orders) rather than a
// build queue entry.
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'
import { Card } from './Card'
import { Badge } from './Badge'

export function SectionStub({ title, blurb, soon = false }: { title: string; blurb: string; soon?: boolean }) {
  if (soon) {
    return (
      <View style={styles.screen}>
        <Card style={styles.soonCard}>
          <Badge status="pending" label="Soon" />
          <Text style={styles.soonBlurb}>{blurb}</Text>
        </Card>
      </View>
    )
  }
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
  soonCard: { opacity: 0.6, gap: theme.spacing(3), alignItems: 'flex-start' },
  soonBlurb: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 21,
  },
})
