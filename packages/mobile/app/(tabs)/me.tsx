// The fourth tab. Grouped by the things you can do, a count on anything
// waiting, and Explore at the bottom — the board's "Me", which replaced a
// centre disc, a popover of six tiles and a modal hub behind them.
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { buildNav } from '@splat-connect/types'
import { useCapabilities } from '../../lib/capabilities'
import { myRoute } from '../../lib/my-routes'
import { theme } from '../../lib/theme'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'
import { ScreenHeader } from '../../components/ui/ScreenHeader'

// Mobile routes, not web hrefs: these are the Explore stack's own screens.
const EXPLORE = [
  { label: 'Learn', href: '/explore/learn' },
  { label: 'Design challenges', href: '/explore/challenges' },
  { label: 'Organisations', href: '/toy-library/organisations' },
  { label: 'About SPLAT', href: '/explore/about' },
]

function Row({ label, count, soon, onPress }: { label: string; count?: number; soon?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.row, soon && styles.soon]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {count ? <Text style={styles.count}>{String(count)}</Text> : null}
      {soon ? <Text style={styles.soonTag}>SOON</Text> : null}
    </Pressable>
  )
}

export default function MeTab() {
  const { caps } = useCapabilities()
  const router = useRouter()
  const go = (href: string) => () => router.push(href as never)
  return (
    <Screen ownHeader>
      {caps ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="My SPLAT" showLogo />
          <Card variant="feature">
            <Text style={styles.name}>Hi, {caps.profile.name.split(' ')[0]}</Text>
            {caps.ledOrgs.length ? <Text style={styles.meta}>Leads {caps.ledOrgs.map((o) => o.name).join(', ')}</Text> : null}
          </Card>
          {buildNav(caps).map((group) => (
            <View key={group.heading} style={styles.group}>
              <Text style={styles.eyebrow}>{group.heading}</Text>
              {group.rows.map((row) => {
                // A web row with no mobile screen yet (printers, events) is
                // SOON here, not a tap that lands back on Me.
                const to = myRoute(row.href)
                const soon = row.soon || to === '/me'
                return <Row key={row.href} label={row.label} count={row.count} soon={soon} onPress={soon ? () => {} : go(to)} />
              })}
            </View>
          ))}
          <View style={styles.group}>
            <Text style={styles.eyebrow}>Explore</Text>
            {EXPLORE.map((row) => (
              <Row key={row.href} label={row.label} onPress={go(row.href)} />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(4), paddingBottom: theme.spacing(8) },
  eyebrow: { fontFamily: theme.fonts.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.muted },
  name: { fontFamily: theme.fonts.black, fontSize: 18, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  group: { gap: theme.spacing(2) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: theme.colors.surface, borderWidth: theme.border.hairline, borderColor: theme.colors.border,
    borderRadius: theme.radii.field, ...theme.shadow(1),
  },
  soon: { opacity: 0.62 },
  rowLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.ink },
  count: {
    fontFamily: theme.fonts.black, fontSize: 12, lineHeight: 18, color: theme.colors.ink,
    backgroundColor: theme.colors.apricot, borderRadius: theme.radii.pill, minWidth: 22, textAlign: 'center', paddingHorizontal: 6,
  },
  soonTag: { fontFamily: theme.fonts.bold, fontSize: 9, letterSpacing: 1, color: theme.colors.muted },
})
