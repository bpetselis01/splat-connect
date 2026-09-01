// packages/mobile/components/organisation/review-queue-screen.tsx
// A leader's queue. Mobile's half of web's app/dashboard/organisation/page.tsx,
// with its rule verbatim: a pending backing row is a request to back; an
// accepted row on a pending tutorial is a request to review. Oldest first — a
// leader arrives asking what is oldest, not what kind of thing is oldest.
//
// The spec also asks for the "Backed" group web's page dropped: accepted
// backings whose tutorial needs nothing, so a leader can see what their name
// stands behind. Same fetch, second filter.
//
// Title comes from the native header (app/(my)/_layout.tsx: "Review queue").
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }
type QueueRow = { tutorial: Backed; row: TutorialOrg; orgName: string }

function Row({
  item,
  showOrg,
  onPress,
}: {
  item: QueueRow
  /** Only when the caller leads several — one org's name on every row is noise. */
  showOrg: boolean
  onPress: () => void
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.tutorial.title}
      accessibilityHint={
        item.row.status === 'pending' ? 'Asked to back this guide. Opens it.' : 'Opens the review.'
      }
      pressScale={0.985}
      style={styles.rowPress}
    >
      <Card style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.tutorial.title}
          </Text>
          <View style={styles.badgeRow}>
            <Badge status={item.row.status} label={item.row.status === 'pending' ? 'Asked to back' : 'Review'} />
            <Badge status={item.tutorial.difficulty} />
            <Badge status={item.tutorial.kind} />
          </View>
          {showOrg ? <Text style={styles.orgLine}>{item.orgName}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </Card>
    </AnimatedPressable>
  )
}

export function ReviewQueueScreen() {
  const router = useRouter()
  const { caps, loading: capsLoading } = useCapabilities()
  const ledOrgs = caps?.ledOrgs ?? []
  const [tutorials, setTutorials] = useState<Backed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const isLeader = ledOrgs.length > 0

  useEffect(() => {
    if (!isLeader) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    setError(false)
    apiClient
      .get<Backed[]>('/api/tutorials')
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch((err) => {
        console.error('[ReviewQueueScreen] tutorials fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, isLeader])

  // Answering a request happens on the detail screen; this list is stale the
  // moment you come back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  // While capabilities are in flight, ledOrgs is empty for everyone — showing
  // the not-a-leader copy in that window tells a real leader this isn't their
  // screen for as long as the fetch takes.
  if (capsLoading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (!isLeader) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title="This screen belongs to organisation leaders."
          hint="When an organisation makes you a leader, what is waiting on it shows up here."
        />
      </Screen>
    )
  }

  const byId = new Map(ledOrgs.map((o) => [o.id, o]))
  const rows: QueueRow[] = tutorials.flatMap((t) =>
    (t.tutorial_orgs ?? [])
      .filter((row) => byId.has(row.org_id))
      .map((row) => ({ tutorial: t, row, orgName: byId.get(row.org_id)!.name }))
  )

  const waiting = rows
    .filter(
      ({ row, tutorial }) =>
        row.status === 'pending' || (row.status === 'accepted' && tutorial.status === 'pending')
    )
    .sort((a, b) => a.tutorial.created_at.localeCompare(b.tutorial.created_at))
  const backed = rows.filter(
    ({ row, tutorial }) => row.status === 'accepted' && tutorial.status !== 'pending'
  )

  const open = (tutorialId: string) => router.push(`/organisation/${tutorialId}`)
  const showOrg = ledOrgs.length > 1

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the queue." hint="Check your connection and try again.">
            <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
          </EmptyState>
        ) : waiting.length === 0 && backed.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title="Nothing waiting."
            hint="Contributors ask by choosing your organisation when they submit a guide."
          />
        ) : (
          <View>
            {waiting.length > 0 ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Waiting on you</Text>
                {waiting.map((item) => (
                  <Row key={item.row.id} item={item} showOrg={showOrg} onPress={() => open(item.tutorial.id)} />
                ))}
              </View>
            ) : null}
            {backed.length > 0 ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Backed</Text>
                {backed.map((item) => (
                  <Row key={item.row.id} item={item} showOrg={showOrg} onPress={() => open(item.tutorial.id)} />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  group: { marginBottom: theme.spacing(4) },
  groupTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 22 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  orgLine: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    marginTop: theme.spacing(2),
  },
})
