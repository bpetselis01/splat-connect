// packages/mobile/app/(my)/admin.tsx
// The board's Admin (MB is_admin): six count cards from one call, each opening
// its queue on the phone.
import { logFailure } from '../../lib/log'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { AdminCounts } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../../components/ui/AnimatedPressable'
import { SectionStub } from '../../components/ui/SectionStub'
import { useCapabilities } from '../../lib/capabilities'

type Icon = React.ComponentProps<typeof Ionicons>['name']

// MB:2953–2959, in its order and words.
const CARDS: { key: keyof AdminCounts; label: string; route: '/admin/review' | '/admin/reports' | '/admin/ideas' | '/admin/spot-check' | '/admin/accounts' | '/admin/organisations'; icon: Icon; tint: string }[] = [
  { key: 'tutorials', label: 'Tutorials awaiting review', route: '/admin/review', icon: 'clipboard-outline', tint: theme.colors.honeySoft },
  { key: 'reports', label: 'Reports from members', route: '/admin/reports', icon: 'flag-outline', tint: theme.colors.apricotSoft },
  { key: 'ideas', label: 'Ideas awaiting review', route: '/admin/ideas', icon: 'bulb-outline', tint: theme.colors.violetSoft },
  { key: 'spotCheck', label: 'Spot-check', route: '/admin/spot-check', icon: 'search-outline', tint: theme.colors.accentLight },
  { key: 'accounts', label: 'Accounts', route: '/admin/accounts', icon: 'people-outline', tint: theme.colors.mintSoft },
  { key: 'organisations', label: 'Organisations', route: '/admin/organisations', icon: 'business-outline', tint: theme.colors.apricotSoft },
]

export default function MyAdmin() {
  const { caps, loading } = useCapabilities()
  if (loading) return null
  if (!caps?.isAdmin) {
    return <SectionStub title="Admin" blurb="This screen belongs to admins. The review queues show up here when your account is one." />
  }
  return <AdminCards />
}

function AdminCards() {
  const router = useRouter()
  const [counts, setCounts] = useState<AdminCounts | null>(null)
  useEffect(() => {
    let ignore = false
    apiClient
      .get<AdminCounts>('/api/admin/counts')
      .then((c) => {
        if (!ignore) setCounts(c)
      })
      .catch((err) => logFailure('[MyAdmin] counts failed:', err))
    return () => {
      ignore = true
    }
  }, [])

  return (
    <View style={styles.screen}>
      <Text style={styles.blurb}>
        The review queues and the report inbox. Anything with a number is waiting for a person.
      </Text>
      <View style={styles.grid}>
        {CARDS.map((card) => {
          const n = counts?.[card.key] ?? null
          return (
            <AnimatedPressable
              key={card.key}
              onPress={() => router.push(card.route)}
              accessibilityRole="button"
              accessibilityLabel={n === null ? card.label : `${card.label}, ${n}`}
              pressScale={0.98}
              style={styles.card}
            >
              <View style={[styles.tile, { backgroundColor: card.tint }]}>
                <Ionicons name={card.icon} size={22} color={theme.colors.ink} />
              </View>
              {n !== null ? <Text style={styles.count}>{String(n)}</Text> : null}
              <Text style={styles.label}>{card.label}</Text>
            </AnimatedPressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  blurb: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    padding: 16,
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  tile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: theme.fonts.display, fontSize: theme.type.display, lineHeight: 32, marginTop: 10, color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, lineHeight: 18, marginTop: 4, color: theme.colors.ink },
})
