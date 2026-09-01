// packages/mobile/app/(my)/admin.tsx
// Five link-out rows, web's app/admin/page.tsx cards. Review tables don't fit
// a phone, so mobile owns none of these screens — the spec's own call. Each
// opens the web, where the admin signs in as themselves.
import { View, Text, Linking, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Card } from '../../components/ui/Card'
import { AnimatedPressable } from '../../components/ui/AnimatedPressable'

const ROWS: { label: string; path: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { label: 'Contributors', path: '/admin/contributors', icon: 'people-outline' },
  { label: 'Review queue', path: '/admin/review', icon: 'file-tray-full-outline' },
  { label: 'Organisations', path: '/admin/organizations', icon: 'business-outline' },
  { label: 'Spot check', path: '/admin/spot-check', icon: 'eye-outline' },
  { label: 'Ideas', path: '/admin/ideas', icon: 'bulb-outline' },
]

export default function MyAdmin() {
  return (
    <View style={styles.screen}>
      <Text style={styles.blurb}>
        Review tables don&apos;t fit a phone. These open on the web, signed in.
      </Text>
      {ROWS.map((row) => (
        <AnimatedPressable
          key={row.path}
          onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${row.path}`)}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          accessibilityHint="Opens on the web."
          pressScale={0.985}
          style={styles.rowPress}
        >
          <Card style={styles.card}>
            <Ionicons name={row.icon} size={20} color={theme.colors.primaryDeep} />
            <Text style={styles.label}>{row.label}</Text>
            <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
          </Card>
        </AnimatedPressable>
      ))}
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
    marginBottom: theme.spacing(4),
  },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  label: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
})
