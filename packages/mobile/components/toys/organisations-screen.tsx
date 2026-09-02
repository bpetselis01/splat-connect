// packages/mobile/components/toys/organisations-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Organization } from '@splat-connect/types'
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
type OrgRow = Pick<Organization, 'id' | 'name' | 'status'>

function OrgRow({ item, onPress }: { item: OrgRow; onPress: () => void }) {
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
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
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
        console.error('[OrganisationsScreen] org fetch failed:', err)
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
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  name: { flex: 1, fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.label },
})
