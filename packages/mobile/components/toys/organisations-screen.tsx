// packages/mobile/components/toys/organisations-screen.tsx
import { logFailure } from '../../lib/log'
import { useEffect, useState } from 'react'
import { View, Text, Image, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { OrgListing } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

// The endpoint returns every organisation, suspended included (web lists and
// marks those); this drill-down keeps it lean and shows active ones only —
// there is no per-row detail here to explain a SUSPENDED badge.
type OrgRow = OrgListing

/** "Newcastle, NSW · 18 backed · 7 toys", or "· has a printer" (MB org_list). */
export function orgListMeta(o: OrgListing): string {
  const place = [o.suburb, o.state].filter(Boolean).join(', ')
  const counts =
    o.backed_count || o.toy_count ? `${o.backed_count} backed · ${o.toy_count} toys` : o.has_printer ? 'has a printer' : null
  return [place || null, counts].filter(Boolean).join(' · ')
}

function OrgRow({ item, onPress }: { item: OrgRow; onPress: () => void }) {
  const meta = orgListMeta(item)
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint="Opens the organisation."
      pressScale={0.985}
      style={styles.rowPress}
    >
      <Card style={styles.card}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {item.verified_at ? (
          <Text style={[styles.badge, styles.verified]}>Verified</Text>
        ) : item.has_printer ? (
          <Text style={[styles.badge, styles.printer]}>Printer</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </Card>
    </AnimatedPressable>
  )
}

export function OrganisationsScreen() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // toy-library-screen's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let ignore = false
    if (!refreshing) setLoading(true)
    setError(null)
    apiClient
      .get<OrgRow[]>('/api/public/organizations')
      .then((data) => {
        if (!ignore) setOrgs(data)
      })
      .catch((err) => {
        logFailure('[OrganisationsScreen] org fetch failed:', err)
        if (!ignore) setError("Couldn't load organisations.")
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const visible = orgs.filter((o) => o.status === 'active')

  return (
    <Screen>
      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load organisations." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No organisations yet"
          hint="Organisations are set up by SPLAT and will show up here once they exist."
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.lead}>{`${visible.length} organisations standing behind the work.`}</Text>}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
          renderItem={({ item }) => (
            <OrgRow item={item} onPress={() => router.push(`/toy-library/organisation/${item.id}`)} />
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  name: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.label },
  body: { flex: 1, minWidth: 0, gap: 2 },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  badge: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.micro,
    color: theme.colors.ink,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  verified: { backgroundColor: theme.colors.successSoft },
  printer: { backgroundColor: theme.colors.apricotSoft },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginBottom: theme.spacing(3) },
})
