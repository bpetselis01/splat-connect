import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { buildNav } from '@splat-connect/types'
import { useCapabilities } from '../../lib/capabilities'
import { myRoute } from '../../lib/my-routes'
import { theme } from '../../lib/theme'
import { Card } from '../../components/ui/Card'

const screenStyle = { flex: 1 as const, backgroundColor: theme.colors.background, padding: theme.spacing(4) }

export default function MySplatHub() {
  const { caps } = useCapabilities()
  const router = useRouter()
  if (!caps) return <View style={screenStyle} />
  return (
    <View style={screenStyle}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card variant="feature">
          <Text style={styles.name}>Hi, {caps.profile.name.split(' ')[0]}</Text>
          {caps.ledOrgs.length ? <Text style={styles.meta}>Leads {caps.ledOrgs.map((o) => o.name).join(', ')}</Text> : null}
        </Card>
        {buildNav(caps).map((group) => (
          <View key={group.heading} style={styles.group}>
            <Text style={styles.eyebrow}>{group.heading}</Text>
            {group.rows.map((row) => (
              <Pressable
                key={row.href}
                onPress={() => router.push(myRoute(row.href) as never)}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                style={[styles.row, row.soon && styles.soon]}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.count ? <Text style={styles.count}>{String(row.count)}</Text> : null}
                {row.soon ? <Text style={styles.soonTag}>SOON</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
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
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, ...theme.shadow(4),
  },
  soon: { opacity: 0.62 },
  rowLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.ink },
  count: {
    fontFamily: theme.fonts.numeral, fontSize: 20, lineHeight: 20, color: theme.colors.primaryDeep,
    backgroundColor: theme.colors.accentLight, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: 4, paddingHorizontal: 6,
  },
  soonTag: { fontFamily: theme.fonts.bold, fontSize: 9, letterSpacing: 1, color: theme.colors.muted },
})
